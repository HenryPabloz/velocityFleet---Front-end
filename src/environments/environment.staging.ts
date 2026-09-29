// Ambiente de homologação (staging).
export const environment = {
  production: false,
  apiUrl: 'https://staging-api.velocityfleet.com',
  appName: 'VelocityFleet (Staging)',
  version: '1.0.0',
  // Precisa ser igual ao API_KEY do back-end de staging. Quem faz o deploy define o valor real.
  apiKey: 'DEFINIR_EM_PRODUCAO',
};
