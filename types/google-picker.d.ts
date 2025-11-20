// Google Picker API types
interface GoogleAuthResponse {
  access_token: string
  expires_in: number
  scope: string
}

interface GoogleUser {
  getAuthResponse: () => GoogleAuthResponse
}

interface GoogleAuthInstance {
  signIn: () => Promise<GoogleUser>
}

interface GoogleAuth2 {
  init: (config: {
    client_id: string
    scope: string
  }) => Promise<void>
  getAuthInstance: () => GoogleAuthInstance
}

interface GoogleApi {
  load: (api: string, callback: () => void) => void
  auth2?: GoogleAuth2
}

// Google Identity Services (new)
interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: { access_token: string; error?: string }) => void
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient: (config: TokenClientConfig) => TokenClient
  }
}

interface GooglePickerDocument {
  id: string
  name: string
  mimeType: string
  url: string
  iconUrl: string
  description?: string
  sizeBytes?: string
}

interface GooglePickerResponse {
  [key: string]: any
  ACTION?: string
  DOCUMENTS?: GooglePickerDocument[]
}

interface GooglePickerBuilder {
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  addView: (viewId: string) => GooglePickerBuilder
  setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder
  build: () => GooglePicker
}

interface GooglePicker {
  setVisible: (visible: boolean) => void
}

interface GooglePickerApi {
  Action: {
    PICKED: string
    CANCEL: string
  }
  Response: {
    ACTION: string
    DOCUMENTS: string
  }
  ViewId: {
    DOCS: string
    SPREADSHEETS: string
  }
  PickerBuilder: new () => GooglePickerBuilder
}

interface Google {
  picker: GooglePickerApi
  accounts?: GoogleAccounts
}

declare global {
  interface Window {
    gapi?: GoogleApi
    google?: Google
  }
}

export type { GooglePickerDocument, GooglePickerResponse }

