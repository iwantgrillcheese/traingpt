import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let service: AuthServiceProtocol
    private let sessionState: SessionState

    init(service: AuthServiceProtocol, sessionState: SessionState) {
        self.service = service
        self.sessionState = sessionState
    }

    func signIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter your email and password."
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await service.signIn(email: email, password: password)
            sessionState.setAuthenticated(true)
        } catch {
            errorMessage = "Unable to sign in. Please try again."
        }
    }
}
