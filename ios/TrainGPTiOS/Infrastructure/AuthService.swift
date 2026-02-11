import Foundation

struct AuthService: AuthServiceProtocol {
    private let apiClient: APIClient
    private let tokenStore: TokenStoreProtocol

    init(apiClient: APIClient, tokenStore: TokenStoreProtocol) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
    }

    func signIn(email: String, password: String) async throws -> UserProfile {
        let payload = ["email": email, "password": password]
        let body = try JSONSerialization.data(withJSONObject: payload)

        let data = try await apiClient.request(path: "auth/sign-in", method: "POST", body: body)
        let response = try JSONDecoder().decode(SignInResponse.self, from: data)
        try tokenStore.saveAccessToken(response.accessToken)

        return response.user
    }

    func signOut() async throws {
        _ = try? await apiClient.request(path: "auth/sign-out", method: "POST")
        try tokenStore.clear()
    }
}

private struct SignInResponse: Decodable {
    let accessToken: String
    let user: UserProfile
}
