// Registrar abastecimento: gasolina a R$ 6,29/L, tanque de 55 L (42 L ~ R$ 264,18).
describe('Abastecimento', () => {
  let idCriado: string | null = null;

  afterEach(() => {
    if (idCriado) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/refuelings/' + idCriado + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idCriado = null;
    }
  });

  it('motorista registra um abastecimento da própria Strada', () => {
    cy.entrar('motorista');
    cy.visit('/refuelings/new');

    cy.get('#campo-abastecimento-veiculo').type('RIO4E56{enter}', { force: true });
    cy.get('#campo-abastecimento-combustivel').select('GASOLINE');
    cy.get('#campo-abastecimento-litros').clear().type('42');
    cy.get('#campo-abastecimento-preco-litro').clear().type('6.29');
    cy.get('#total-estimado-abastecimento').should('contain.text', '264,18');

    cy.get('#botao-salvar-abastecimento').click();
    cy.get('#botao-confirmar').click();

    cy.url({ timeout: 15000 }).should('match', /\/refuelings\/[0-9a-f-]{36}$/);
    cy.url().then((url) => (idCriado = url.split('/refuelings/')[1]));
  });
});
