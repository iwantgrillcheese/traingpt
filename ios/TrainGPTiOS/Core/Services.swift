import Foundation

protocol AuthServiceProtocol {
    func signIn(email: String, password: String) async throws -> UserProfile
    func signOut() async throws
}

protocol DashboardServiceProtocol {
    func fetchSummary() async throws -> DashboardSummary
}

@MainActor
final class SessionState: ObservableObject {
    @Published private(set) var isAuthenticated = false

    private let tokenStore: TokenStoreProtocol

    init(tokenStore: TokenStoreProtocol) {
        self.tokenStore = tokenStore
        self.isAuthenticated = (try? tokenStore.readAccessToken()) != nil
    }

    func setAuthenticated(_ value: Bool) {
        isAuthenticated = value
    }
}

protocol TokenStoreProtocol {
    func readAccessToken() throws -> String?
    func saveAccessToken(_ token: String) throws
    func clear() throws
}
