import { useState, useEffect, useCallback } from 'react'

interface GooglePickerConfig {
  clientId: string
  apiKey?: string | null
}

export function useGooglePicker() {
  const [isLoading, setIsLoading] = useState(false)
  const [isApiLoaded, setIsApiLoaded] = useState(false)
  const [config, setConfig] = useState<GooglePickerConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Загрузка Google API скриптов (Google Identity Services + Picker)
  const loadGoogleApi = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not available'))
        return
      }

      // Если уже загружено
      if (window.google?.accounts?.oauth2 && window.google?.picker && window.gapi) {
        setIsApiLoaded(true)
        resolve()
        return
      }

      // Загрузить Google Identity Services
      const loadGis = (): Promise<void> => {
        return new Promise((gisResolve, gisReject) => {
          if (window.google?.accounts?.oauth2) {
            gisResolve()
            return
          }

          const existingGis = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
          if (existingGis) {
            const checkInterval = setInterval(() => {
              if (window.google?.accounts?.oauth2) {
                clearInterval(checkInterval)
                gisResolve()
              }
            }, 100)
            setTimeout(() => {
              clearInterval(checkInterval)
              if (!window.google?.accounts?.oauth2) {
                gisReject(new Error('Google Identity Services loading timeout'))
              }
            }, 10000)
            return
          }

          const gisScript = document.createElement('script')
          gisScript.src = 'https://accounts.google.com/gsi/client'
          gisScript.async = true
          gisScript.defer = true
          gisScript.onload = () => {
            if (window.google?.accounts?.oauth2) {
              gisResolve()
            } else {
              gisReject(new Error('Failed to load Google Identity Services'))
            }
          }
          gisScript.onerror = () => gisReject(new Error('Failed to load Google Identity Services script'))
          document.head.appendChild(gisScript)
        })
      }

      // Загрузить Google Picker API
      const loadPicker = (): Promise<void> => {
        return new Promise((pickerResolve, pickerReject) => {
          if (window.gapi && window.google?.picker) {
            pickerResolve()
            return
          }

          const existingApi = document.querySelector('script[src="https://apis.google.com/js/api.js"]')
          if (existingApi) {
            const checkInterval = setInterval(() => {
              if (window.gapi && window.google?.picker) {
                clearInterval(checkInterval)
                pickerResolve()
              } else if (window.gapi && !window.google?.picker) {
                window.gapi.load('picker', () => {
                  clearInterval(checkInterval)
                  pickerResolve()
                })
              }
            }, 100)
            setTimeout(() => {
              clearInterval(checkInterval)
              if (!window.gapi || !window.google?.picker) {
                pickerReject(new Error('Google Picker API loading timeout'))
              }
            }, 10000)
            return
          }

          const apiScript = document.createElement('script')
          apiScript.src = 'https://apis.google.com/js/api.js'
          apiScript.async = true
          apiScript.defer = true
          apiScript.onload = () => {
            if (!window.gapi) {
              pickerReject(new Error('Failed to load Google API'))
              return
            }
            window.gapi.load('picker', () => {
              if (window.google?.picker) {
                pickerResolve()
              } else {
                pickerReject(new Error('Failed to load Google Picker'))
              }
            })
          }
          apiScript.onerror = () => pickerReject(new Error('Failed to load Google API script'))
          document.head.appendChild(apiScript)
        })
      }

      // Загрузить оба скрипта параллельно
      Promise.all([loadGis(), loadPicker()])
        .then(() => {
          setIsApiLoaded(true)
          resolve()
        })
        .catch(reject)
    })
  }, [])

  // Получить конфигурацию с сервера
  const loadConfig = useCallback(async (): Promise<GooglePickerConfig> => {
    const response = await fetch('/api/google-drive/config')
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get Google Drive configuration')
    }

    const data = await response.json()
    return data
  }, [])

  // Инициализация: загрузить API и конфигурацию
  const initialize = useCallback(async () => {
    if (isApiLoaded && config) {
      return // Уже инициализировано
    }

    setIsLoading(true)
    setError(null)

    try {
      // Загрузить конфигурацию
      const loadedConfig = await loadConfig()
      setConfig(loadedConfig)

      // Загрузить Google API
      await loadGoogleApi()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Google Picker'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isApiLoaded, config, loadConfig, loadGoogleApi])

  // Открыть Google Picker
  const openPicker = useCallback(async (onFilePicked: (file: any, accessToken: string) => void) => {
    // Инициализировать если нужно
    if (!config || !isApiLoaded) {
      await initialize()
    }

    // Дождаться загрузки API и конфигурации
    let currentConfig = config
    if (!currentConfig) {
      currentConfig = await loadConfig()
      setConfig(currentConfig)
    }

    // Дождаться загрузки Google API
    if (!window.gapi || !window.google) {
      await loadGoogleApi()
    }

    // Финальная проверка
    if (!currentConfig) {
      throw new Error('Google Picker configuration is missing')
    }
    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services is not loaded')
    }
    if (!window.google?.picker) {
      throw new Error('Google Picker API is not loaded')
    }

    try {
      // Получить токен через Google Identity Services
      console.log('Requesting OAuth token via Google Identity Services...', { 
        clientId: currentConfig.clientId,
        origin: typeof window !== 'undefined' ? window.location.origin : 'unknown'
      })

      const accessToken = await new Promise<string>((resolve, reject) => {
        const tokenClient = window.google!.accounts!.oauth2.initTokenClient({
          client_id: currentConfig.clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response) => {
            if (response.error) {
              let errorMessage = 'Unknown error'
              let errorDetails = ''
              
              if (typeof response.error === 'string') {
                errorMessage = response.error
              } else if (response.error && typeof response.error === 'object') {
                const errorObj = response.error as Record<string, unknown>
                if ('message' in errorObj && typeof errorObj.message === 'string') {
                  errorMessage = errorObj.message
                } else {
                  errorMessage = String(response.error)
                }
              }

              // Handle specific errors
              if (errorMessage.includes('popup_closed_by_user') || errorMessage.includes('access_denied')) {
                reject(new Error('Authorization cancelled by user'))
                return
              }

              const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown'
              const detailedMessage = `OAuth token request failed.\n\n` +
                `Current origin: ${currentOrigin}\n` +
                `Client ID: ${currentConfig.clientId}\n\n` +
                `Steps to fix:\n\n` +
                `1. Verify the Client ID matches:\n` +
                `   → Go to: https://console.cloud.google.com/apis/credentials\n` +
                `   → Find Client ID: ${currentConfig.clientId}\n` +
                `   → If different, update GOOGLE_CLIENT_ID in .env.local and restart dev server\n\n` +
                `2. Add origin to Authorized JavaScript origins:\n` +
                `   → In the same Client ID settings\n` +
                `   → Add "${currentOrigin}" to "Authorized JavaScript origins"\n` +
                `   → Click "SAVE" and wait 5-10 minutes for changes to propagate\n\n` +
                `3. Add your email as a test user (if app is in testing):\n` +
                `   → Go to: https://console.cloud.google.com/apis/credentials/consent\n` +
                `   → Add your email to "Test users"\n\n` +
                `\nError: ${errorMessage}`
              
              reject(new Error(detailedMessage))
              return
            }

            if (!response.access_token) {
              reject(new Error('Access token not found in response'))
              return
            }

            console.log('Access token obtained via Google Identity Services')
            resolve(response.access_token)
          }
        })

        // Запросить токен
        tokenClient.requestAccessToken()
      })

      // Создать Picker
      try {
        let builder = new window.google!.picker.PickerBuilder()
          .setOAuthToken(accessToken)
          .addView(window.google!.picker.ViewId.DOCS)
          .addView(window.google!.picker.ViewId.SPREADSHEETS)

        // Добавить API key если есть
        if (currentConfig.apiKey) {
          builder = builder.setDeveloperKey(currentConfig.apiKey)
        }

        const picker = builder.setCallback((data: any) => {
          if (data[window.google!.picker.Response.ACTION] === window.google!.picker.Action.PICKED) {
            const file = data[window.google!.picker.Response.DOCUMENTS][0]
            onFilePicked(file, accessToken)
          }
        }).build()
        
        console.log('Picker created, showing...')
        picker.setVisible(true)
      } catch (pickerError) {
        console.error('Picker creation error:', pickerError)
        throw new Error(`Failed to create Picker: ${pickerError instanceof Error ? pickerError.message : 'Unknown error'}`)
      }
    } catch (err) {
      const errorToThrow = err instanceof Error 
        ? err 
        : new Error(typeof err === 'string' ? err : 'Failed to open Google Picker')
      
      setError(errorToThrow.message)
      throw errorToThrow
    }
  }, [config, isApiLoaded, initialize, loadConfig, loadGoogleApi])

  return {
    isLoading,
    isApiLoaded,
    error,
    initialize,
    openPicker
  }
}

