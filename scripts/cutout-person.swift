// Writes, for each "in out" pair, a grey mask of the person (the system's subject lifting).
import Foundation
import Vision
import CoreImage
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
let ctx = CIContext()
var i = 0
while i + 1 < args.count {
  let src = URL(fileURLWithPath: args[i]), dst = URL(fileURLWithPath: args[i + 1]); i += 2
  guard let image = CIImage(contentsOf: src) else { fputs("cannot read \(src.path)\n", stderr); exit(1) }
  let handler = VNImageRequestHandler(ciImage: image)
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])
  guard let result = request.results?.first else { fputs("no subject in \(src.path)\n", stderr); exit(2) }
  let buffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
  let mask = CIImage(cvPixelBuffer: buffer)
  let rep = NSBitmapImageRep(ciImage: mask.cropped(to: image.extent))
  try rep.representation(using: .png, properties: [:])!.write(to: dst)
}
