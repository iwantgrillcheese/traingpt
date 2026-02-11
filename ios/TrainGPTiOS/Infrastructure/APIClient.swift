import Foundation

struct APIClient {
    let baseURL: URL
    private let tokenStore: TokenStoreProtocol

    init(baseURL: URL, tokenStore: TokenStoreProtocol) {
        self.baseURL = baseURL
        self.tokenStore = tokenStore
    }

    func request(path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = try tokenStore.readAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed
        }

        return data
    }
}

enum APIError: Error {
    case requestFailed
    case decodingFailed
    case missingToken
}
