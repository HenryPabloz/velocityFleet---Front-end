// Comandos customizados do Cypress. As credenciais vêm de Cypress.env() (cypress.env.json),
// nunca hardcoded aqui — veja cypress.env.example.json para o formato.

export type PapelDeTeste = 'motorista' | 'gerente' | 'admin';

interface CredenciaisDoPapel {
  email: string;
  senha: string;
  apiKey: string;
}

function credenciaisDoPapel(papel: PapelDeTeste): CredenciaisDoPapel {
  if (papel === 'admin') {
    return {
      email: Cypress.env('adminEmail'),
      senha: Cypress.env('adminSenha'),
      apiKey: Cypress.env('adminApiKey'),
    };
  }
  if (papel === 'gerente') {
    return {
      email: Cypress.env('gerenteEmail'),
      senha: Cypress.env('gerenteSenha'),
      apiKey: Cypress.env('gerenteApiKey'),
    };
  }
  return {
    email: Cypress.env('motoristaEmail'),
    senha: Cypress.env('motoristaSenha'),
    apiKey: Cypress.env('motoristaApiKey'),
  };
}

// Loga direto pela API (POST /auth/login com x-api-key) e grava a sessão no localStorage,
// do mesmo jeito que o AuthStateService grava depois de um login pela tela.
Cypress.Commands.add('entrar', (papel: PapelDeTeste) => {
  const credenciais = credenciaisDoPapel(papel);
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3000';

  cy.request({
    method: 'POST',
    url: apiUrl + '/auth/login',
    headers: { 'x-api-key': credenciais.apiKey },
    body: { email: credenciais.email, password: credenciais.senha },
  }).then((resposta) => {
    cy.window().then((janela) => {
      janela.localStorage.setItem('access_token', resposta.body.accessToken);
      janela.localStorage.setItem('user', JSON.stringify(resposta.body.user));
      janela.localStorage.setItem('api_key', credenciais.apiKey);
    });
  });
});

// Pega um JWT de ADMIN direto (sem passar pela tela), usado nos "after" para limpar dados criados.
Cypress.Commands.add('jwtAdmin', () => {
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3000';
  return cy
    .request({
      method: 'POST',
      url: apiUrl + '/auth/login',
      headers: { 'x-api-key': Cypress.env('adminApiKey') },
      body: { email: Cypress.env('adminEmail'), password: Cypress.env('adminSenha') },
    })
    .then((resposta) => resposta.body.accessToken as string);
});

// Sufixo curto e único por execução, para placas/e-mails não colidirem com dados existentes.
Cypress.Commands.add('sufixoUnico', () => {
  return Cypress._.random(100, 999).toString();
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      entrar(papel: PapelDeTeste): Chainable<void>;
      jwtAdmin(): Chainable<string>;
      sufixoUnico(): Chainable<string>;
    }
  }
}

export {};
