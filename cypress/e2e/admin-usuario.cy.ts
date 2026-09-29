// Admin cria um usuário DRIVER com CNH e vê o modal da API key (mostrada uma única vez).
describe('Admin: criar usuário motorista', () => {
  let idCriado: string | null = null;
  let sufixo: string;

  before(() => {
    cy.sufixoUnico().then((valor) => (sufixo = valor));
  });

  afterEach(() => {
    if (idCriado) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/users/' + idCriado + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idCriado = null;
    }
  });

  it('cria um motorista novo com CNH e vê a API key uma única vez', () => {
    cy.intercept('POST', '**/users').as('criarUsuario');
    cy.entrar('admin');
    cy.visit('/admin/users/new');

    cy.get('#campo-usuario-nome').type('Fernanda Costa Ribeiro');
    cy.get('#campo-usuario-email').type('fernanda.ribeiro.' + sufixo + '@velocityfleet.com.br');
    cy.get('#campo-usuario-senha').type('Frota@2026Teste');
    cy.get('#campo-usuario-papel option').contains('Motorista').then((opcao) => {
      cy.get('#campo-usuario-papel').select(opcao.val() as string);
    });
    cy.get('#campo-usuario-cnh').type('05938174652');
    cy.get('#campo-usuario-validade-cnh').type('2032-06-30');

    cy.get('#botao-criar-usuario').click();
    cy.get('#botao-confirmar').click();
    cy.wait('@criarUsuario').then((intercepcao) => {
      idCriado = intercepcao.response?.body.id ?? null;
    });

    // A chave só aparece agora e desaparece ao fechar o modal (backdrop static, sem Esc).
    cy.get('#titulo-modal-api-key', { timeout: 15000 }).should('be.visible');
    cy.get('#campo-api-key-exibida').invoke('val').should('match', /^vf_live_/);
    cy.get('#botao-ja-entreguei').click();
    cy.get('#titulo-modal-api-key').should('not.exist');

    cy.url({ timeout: 10000 }).should('include', '/admin/users');
  });
});
