// Registrar incidente com foto (multipart/form-data, campo "photo").
describe('Incidente', () => {
  let idCriado: string | null = null;

  afterEach(() => {
    if (idCriado) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/incidents/' + idCriado + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idCriado = null;
    }
  });

  it('motorista registra um incidente mecânico com foto do pneu', () => {
    cy.entrar('motorista');
    cy.visit('/incidents/new');

    cy.get('#campo-incidente-veiculo').type('RIO4E56{enter}', { force: true });
    cy.get('#campo-incidente-tipo').select('MECHANICAL_FAILURE');
    cy.get('#campo-incidente-severidade').select('MEDIUM');
    cy.get('#campo-incidente-descricao').type('Pneu dianteiro direito estourado na BR-116, km 214, sem feridos');
    cy.get('#input-foto-incidente').selectFile('cypress/fixtures/pneu-estourado.jpg', { force: true });
    cy.get('#foto-escolhida').should('be.visible');

    cy.get('#botao-registrar-incidente').click();
    cy.get('#botao-confirmar').click();

    cy.url({ timeout: 15000 }).should('match', /\/incidents\/[0-9a-f-]{36}$/);
    cy.url().then((url) => (idCriado = url.split('/incidents/')[1]));
  });
});
