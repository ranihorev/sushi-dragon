import ExpoModulesCore

/**
 The app's own corner of iCloud.

 There is no way to reach it from JavaScript: `expo-file-system` knows about the
 documents folder, the cache and the bundle, and nothing about the ubiquity
 container, which is the only folder in this app that another device can see.
 The two community packages that fill the gap were last published in 2024 and
 2022, neither for the New Architecture, so this is ours. It is deliberately
 small — it opens a folder and moves bytes in and out of it, and every decision
 about what those bytes mean is made in TypeScript where it can be tested.

 Everything goes through `NSFileCoordinator`. Uncoordinated writes to a
 ubiquitous file are a race against the daemon uploading it, and the prize for
 losing is a file iCloud thinks is in conflict, which it resolves by keeping
 both copies and waiting to be asked which one you wanted.

 Everything also lives under `Data/`, not `Documents/`. Documents would put the
 whole thing in the Files app, where it is one absent-minded tidy-up away from
 being the words your child was learning last month.
 */
public class SushiICloudModule: Module {
  private var cachedContainer: URL?
  private var query: NSMetadataQuery?
  private var watchers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("SushiICloud")

    Events("onChange")

    /// Is there an iCloud account signed in with Drive turned on.
    AsyncFunction("isAvailable") { () -> Bool in
      self.container() != nil
    }

    /**
     The text of a file, or nil if it is not there.

     Coordinating the read is also what fetches a file this device has never
     seen: the coordinator blocks until iCloud has produced the contents, which
     is exactly the behaviour wanted here and exactly why this is an
     `AsyncFunction` — it must not happen on the thread drawing the dragon.
     */
    AsyncFunction("read") { (path: String) -> String? in
      guard let url = try self.resolve(path) else { return nil }
      guard let data = try self.coordinatedRead(url) else { return nil }
      return String(data: data, encoding: .utf8)
    }

    AsyncFunction("write") { (path: String, contents: String) in
      guard let url = try self.resolve(path) else { throw NoContainer() }
      try self.coordinatedWrite(url, Data(contents.utf8))
    }

    /// What is in a folder, and whether each one has actually arrived yet.
    AsyncFunction("list") { (dir: String) -> [[String: Any]] in
      guard let url = try self.resolve(dir) else { return [] }
      return self.contents(of: url)
    }

    /// A local file into iCloud. Used for a recording just made on this device.
    AsyncFunction("copyIn") { (path: String, from: String) in
      guard let url = try self.resolve(path) else { throw NoContainer() }
      try self.coordinatedWrite(url, try Data(contentsOf: Self.fileURL(from)))
    }

    /// A file out of iCloud onto this device, fetching it first if need be.
    AsyncFunction("copyOut") { (path: String, to: String) in
      guard let url = try self.resolve(path) else { throw NoContainer() }
      guard let data = try self.coordinatedRead(url) else { throw NotThere(path: path) }
      let target = Self.fileURL(to)
      try FileManager.default.createDirectory(
        at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.write(to: target, options: .atomic)
    }

    AsyncFunction("remove") { (path: String) in
      guard let url = try self.resolve(path) else { return }
      var coordinationError: NSError?
      NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordinationError) { target in
        try? FileManager.default.removeItem(at: target)
      }
      if let coordinationError { throw coordinationError }
    }

    /// Ask iCloud to start fetching something, without waiting for it.
    AsyncFunction("download") { (path: String) in
      guard let url = try self.resolve(path) else { return }
      try? FileManager.default.startDownloadingUbiquitousItem(at: url)
    }

    /* Watching costs a running query, so it only runs while somebody is
       listening — which is what makes the iPad notice a word added on the phone
       without being closed and opened again. */
    OnStartObserving { self.startWatching() }
    OnStopObserving { self.stopWatching() }
    OnDestroy { self.stopWatching() }
  }

  // MARK: - the container

  private struct NoContainer: Error {}
  private struct NotThere: Error { let path: String }

  /**
   A local file, however the caller spelled it.

   `expo-file-system` hands out `file:///…` and a plain path is what anything
   else produces, and the difference is not the caller's problem.
   */
  private static func fileURL(_ path: String) -> URL {
    if path.hasPrefix("file://"), let url = URL(string: path) { return url }
    return URL(fileURLWithPath: path)
  }

  /**
   The container, found once and kept.

   Finding it talks to the iCloud daemon and can take a moment, which is why
   nothing here is a synchronous `Function`. It comes back nil when there is no
   account signed in, and that is not an error — it is a house that has not set
   iCloud up, and the game plays perfectly well on one device.
   */
  private func container() -> URL? {
    if let cachedContainer { return cachedContainer }
    guard let url = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
      return nil
    }
    cachedContainer = url
    return url
  }

  private func base() -> URL? {
    container()?.appendingPathComponent("Data", isDirectory: true)
  }

  private func resolve(_ path: String) throws -> URL? {
    guard let base = base() else { return nil }
    // no climbing out of the container, however the caller spells it
    guard !path.contains("..") else { throw NoContainer() }
    return base.appendingPathComponent(path)
  }

  // MARK: - moving bytes

  private func coordinatedRead(_ url: URL) throws -> Data? {
    var result: Data?
    var failure: Error?
    var coordinationError: NSError?

    NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { target in
      do {
        result = try Data(contentsOf: target)
      } catch {
        failure = error
      }
    }

    if let coordinationError { throw coordinationError }
    if let failure {
      // a file that was never written is an empty answer, not a fault
      let code = (failure as NSError).code
      if code == NSFileReadNoSuchFileError || code == NSFileNoSuchFileError { return nil }
      throw failure
    }
    return result
  }

  private func coordinatedWrite(_ url: URL, _ data: Data) throws {
    try FileManager.default.createDirectory(
      at: url.deletingLastPathComponent(), withIntermediateDirectories: true)

    var failure: Error?
    var coordinationError: NSError?

    NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { target in
      do {
        try data.write(to: target, options: .atomic)
      } catch {
        failure = error
      }
    }

    if let coordinationError { throw coordinationError }
    if let failure { throw failure }
  }

  /**
   What is in a folder.

   A file that iCloud knows about but has not fetched shows up as a hidden
   placeholder called `.the-real-name.icloud`, so the name is put back together
   before it is handed over — the caller asked what is in the folder, not how
   iCloud happens to be storing it today.
   */
  private func contents(of url: URL) -> [[String: Any]] {
    let keys: [URLResourceKey] = [.ubiquitousItemDownloadingStatusKey, .fileSizeKey]
    guard
      let found = try? FileManager.default.contentsOfDirectory(
        at: url, includingPropertiesForKeys: keys, options: [])
    else { return [] }

    return found.map { item in
      let values = try? item.resourceValues(forKeys: Set(keys))
      let status = values?.ubiquitousItemDownloadingStatus
      var name = item.lastPathComponent
      var placeholder = false

      if name.hasPrefix("."), name.hasSuffix(".icloud") {
        name = String(name.dropFirst().dropLast(".icloud".count))
        placeholder = true
      }

      return [
        "name": name,
        "downloaded": !placeholder && status != .notDownloaded,
        "size": values?.fileSize ?? 0,
      ]
    }
  }

  // MARK: - noticing the other device

  private func startWatching() {
    guard let base = base() else { return }

    DispatchQueue.main.async {
      guard self.query == nil else { return }

      let query = NSMetadataQuery()
      query.searchScopes = [NSMetadataQueryUbiquitousDataScope]
      query.predicate = NSPredicate(format: "%K BEGINSWITH %@", NSMetadataItemPathKey, base.path)

      /* Both notifications, because the first one is the answer to "what is
         there" and the rest are "and now this changed". Only the second kind is
         news, but a device that has just woken up needs the first to find out
         what it missed. */
      for name in [
        NSNotification.Name.NSMetadataQueryDidFinishGathering,
        NSNotification.Name.NSMetadataQueryDidUpdate,
      ] {
        let watcher = NotificationCenter.default.addObserver(
          forName: name, object: query, queue: .main
        ) { [weak self] _ in
          self?.sendEvent("onChange", [:])
        }
        self.watchers.append(watcher)
      }

      self.query = query
      query.start()
      query.enableUpdates()
    }
  }

  private func stopWatching() {
    DispatchQueue.main.async {
      self.query?.disableUpdates()
      self.query?.stop()
      self.query = nil
      for watcher in self.watchers { NotificationCenter.default.removeObserver(watcher) }
      self.watchers = []
    }
  }
}
