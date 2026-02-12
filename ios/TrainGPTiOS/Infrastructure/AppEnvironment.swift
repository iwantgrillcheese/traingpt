import Foundation

enum AppEnvironment {
    static let current = EnvironmentValues(
        apiBaseURL: URL(string: "https://api.traingpt.app")!
    )

    struct EnvironmentValues {
        let apiBaseURL: URL
    }
}
