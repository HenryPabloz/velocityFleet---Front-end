// Login: formulário, validação, erro de credenciais, sucesso e ausência do link de cadastro.
describe('Login', () => {
  beforeEach(() => cy.visit('/auth/login'));

  it('não tem link de cadastro público (contas nascem no admin)', () => {
    cy.get('#aviso-sem-conta').should('contain.text', 'administrador ou gerente');
    cy.get('a').contains(/cadastr|criar conta/i).should('not.exist');
  });

  it('enviar vazio mostra os três erros obrigatórios', () => {
    cy.get('#botao-entrar').click();
    cy.get('#erro-email').should('be.visible');
    cy.get('#erro-senha').should('be.visible');
    cy.get('#erro-api-key').should('be.visible');
  });

  it('e-mail sem formato válido é recusado', () => {
    cy.get('#campo-email').type('marcos.andrade@velocityfleet');
    cy.get('#campo-senha').type('Frota@2026');
    cy.get('#campo-api-key').type('vf_live_qualquer');
    cy.get('#botao-entrar').click();
    cy.get('#erro-email').should('contain.text', 'e-mail válido');
  });

  it('credenciais erradas mostram "E-mail, senha ou API key não conferem." e não navegam', () => {
    cy.get('#campo-email').type(Cypress.env('motoristaEmail'));
    cy.get('#campo-senha').type('SenhaCertamenteErrada1');
    cy.get('#campo-api-key').type(Cypress.env('motoristaApiKey'));
    cy.get('#botao-entrar').click();
    cy.get('#alerta-erro-login').should('contain.text', 'não conferem');
    cy.url().should('include', '/auth/login');
  });

  it('login com sucesso leva ao dashboard', () => {
    cy.get('#campo-email').type(Cypress.env('motoristaEmail'));
    cy.get('#campo-senha').type(Cypress.env('motoristaSenha'));
    cy.get('#campo-api-key').type(Cypress.env('motoristaApiKey'));
    cy.get('#botao-entrar').click();
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
  });
});
