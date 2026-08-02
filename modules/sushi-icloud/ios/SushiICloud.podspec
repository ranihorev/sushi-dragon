require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'SushiICloud'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = <<~DESC
    Reads and writes the app's iCloud container through NSFileCoordinator, and
    reports when another device changes something in it. Everything that decides
    what those bytes mean lives in TypeScript.
  DESC
  s.license        = package['license']
  s.author         = 'Sushi Dragon'
  s.homepage       = 'https://github.com/ranihorev/sushi_dragon'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  # a local module: the source is the folder this file is in
  s.source         = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
