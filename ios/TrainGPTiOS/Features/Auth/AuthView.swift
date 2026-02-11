import SwiftUI

struct AuthView: View {
    @StateObject var viewModel: AuthViewModel

    var body: some View {
        VStack(spacing: 16) {
            Text("TrainGPT")
                .font(.largeTitle)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                TextField("Email", text: $viewModel.email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                SecureField("Password", text: $viewModel.password)
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task { await viewModel.signIn() }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Continue")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(viewModel.isLoading)
        }
        .padding(24)
    }
}
