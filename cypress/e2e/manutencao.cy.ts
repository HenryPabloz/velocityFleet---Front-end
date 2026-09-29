// Agendar e concluir uma manutenção (só ADMIN/FLEET_MANAGER têm acesso ao módulo).
describe('Manutenção', () => {
  let idCriada: string | null = null;

  afterEach(() => {
    if (idCriada) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/maintenances/' + idCriada + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idCriada = null;
    }
  });

  it('gerente agenda a troca de óleo da Strada e depois conclui a manutenção', () => {
    cy.entrar('gerente');
    cy.visit('/maintenance/new');

    cy.get('#campo-manutencao-veiculo').type('RIO4E56{enter}', { force: true });
    cy.get('[data-tom] input[value="PREVENTIVE"]').check({ force: true });
    cy.get('#campo-manutencao-data').type('2026-10-15');
    cy.get('#campo-manutencao-custo').clear().type('480');
    cy.get('#campo-manutencao-descricao').type('Troca de óleo e filtros aos 20.000 km');

    cy.get('#botao-agendar-manutencao').click();
    cy.get('#botao-confirmar').click();

    cy.url({ timeout: 15000 }).should('match', /\/maintenance\/[0-9a-f-]{36}$/);
    cy.url().then((url) => {
      idCriada = url.split('/maintenance/')[1];
      cy.get('#botao-concluir-manutencao').click();
      cy.get('#botao-confirmar').click();
      cy.get('#pagina-manutencao-detalhe', { timeout: 10000 }).should('contain.text', 'Concluída');
    });
  });
});
