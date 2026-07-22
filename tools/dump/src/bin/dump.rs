//! dump <save> <out>: write the decompressed protobuf payload to a file.
use bellwright_gold_editor::SaveFile;
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let s = SaveFile::load(&args[1]).expect("load failed");
    std::fs::write(&args[2], &s.decompressed).expect("write failed");
    eprintln!("wrote {} bytes ({} / {} / {})", s.decompressed.len(), s.display_name, s.village, s.character);
}
