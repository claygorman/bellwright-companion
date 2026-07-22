// pakdump — CUE4Parse-based Bellwright pak/IoStore inspector.
//   dotnet run -- <PaksDir> info                 mount info: file count, encryption
//   dotnet run -- <PaksDir> list [substring]     list file paths (optionally filtered)
//   dotnet run -- <PaksDir> export <assetPath>   dump one asset's exports as JSON
// Optional env: USMAP=/path/to/Mappings.usmap, GAME=GAME_UE5_4
using CUE4Parse.Compression;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Versions;
using Newtonsoft.Json;

var paksDir = args.Length > 0 ? args[0] : throw new Exception("usage: pakdump <PaksDir> <cmd> [arg]");
var cmd = args.Length > 1 ? args[1] : "info";
var arg = args.Length > 2 ? args[2] : null;

var game = Enum.Parse<EGame>(Environment.GetEnvironmentVariable("GAME") ?? "GAME_UE5_4");

// OodleUE publishes no macOS native — on a Mac run this inside a Linux
// container and point OODLE at the matching liboodle-data-shared.so
var oodlePath = Environment.GetEnvironmentVariable("OODLE");
if (oodlePath == null)
{
    if (!OodleHelper.DownloadOodleDll()) throw new Exception("oodle native download failed");
    oodlePath = OodleHelper.OodleFileName;
}
OodleHelper.Initialize(oodlePath);

var provider = new DefaultFileProvider(paksDir, SearchOption.TopDirectoryOnly, new VersionContainer(game));
var usmap = Environment.GetEnvironmentVariable("USMAP");
if (usmap != null) provider.MappingsContainer = new FileUsmapTypeMappingsProvider(usmap, StringComparer.OrdinalIgnoreCase);
provider.Initialize();
provider.Mount();

switch (cmd)
{
    case "info":
        Console.WriteLine($"game={game} files={provider.Files.Count}");
        foreach (var vfs in provider.MountedVfs) Console.WriteLine($"mounted: {vfs.Name} files={vfs.FileCount} encrypted={vfs.IsEncrypted}");
        foreach (var vfs in provider.UnloadedVfs) Console.WriteLine($"UNLOADED: {vfs.Name} encrypted={vfs.IsEncrypted}");
        break;
    case "list":
        foreach (var k in provider.Files.Keys)
            if (arg == null || k.Contains(arg, StringComparison.OrdinalIgnoreCase))
                Console.WriteLine(k);
        break;
    case "export":
        var pkg = provider.LoadPackage(arg!);
        Console.WriteLine(JsonConvert.SerializeObject(pkg.GetExports(), Formatting.Indented));
        break;
    case "exportfile":
        // loose (uncooked editor) .uasset — self-describing tagged properties, no usmap needed
        var bytes = File.ReadAllBytes(arg!);
        var name = Path.GetFileNameWithoutExtension(arg!);
        var uexp = Path.ChangeExtension(arg!, ".uexp");
        var loose = new CUE4Parse.UE4.Assets.Package(name, bytes,
            File.Exists(uexp) ? File.ReadAllBytes(uexp) : null, null, null, provider, false);
        var objs = loose.ExportsLazy.Select(l => l.Value).ToArray();
        Console.WriteLine(JsonConvert.SerializeObject(objs, Formatting.Indented));
        break;
    case "exportdir":
        // batch: walk <arg> for .uasset, write one JSON per asset into <arg2 = out dir>
        var outDir = args.Length > 3 ? args[3] : "/out";
        var files = Directory.GetFiles(arg!, "*.uasset", SearchOption.AllDirectories);
        int ok = 0, fail = 0;
        foreach (var f in files)
        {
            try
            {
                var b = File.ReadAllBytes(f);
                var n = Path.GetFileNameWithoutExtension(f);
                var ux = Path.ChangeExtension(f, ".uexp");
                var p2 = new CUE4Parse.UE4.Assets.Package(n, b,
                    File.Exists(ux) ? File.ReadAllBytes(ux) : null, null, null, provider, false);
                var o = p2.ExportsLazy.Select(l => l.Value).ToArray();
                var rel = Path.GetRelativePath(arg!, f).Replace('/', '_').Replace('\\', '_');
                File.WriteAllText(Path.Combine(outDir, Path.ChangeExtension(rel, ".json")),
                    JsonConvert.SerializeObject(o, Formatting.Indented));
                ok++;
            }
            catch (Exception e) { fail++; Console.WriteLine($"FAIL {f}: {e.Message.Split('\n')[0]}"); }
        }
        Console.WriteLine($"exported {ok}, failed {fail}");
        break;
    default:
        throw new Exception($"unknown cmd {cmd}");
}
