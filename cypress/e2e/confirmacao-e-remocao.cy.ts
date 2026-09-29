// Pop-ups de confirmação (cancelar não envia, confirmar envia) e o ciclo
// soft delete -> aba Removidos -> restaurar -> exclusão definitiva (só ADMIN).
describe('Confirmação e remoção de veículos', () => {
  let placaCriada: string;
  let idCriado: string | null = null;

  before(() => {
    cy.sufixoUnico().then((sufixo) => {
      // Placa Mercosul fictícia e única por execução (últimos 3 números trocados).
      placaCriada = 'TST' + sufixo.charAt(0) + 'E' + sufixo.slice(1);
    });
  });

  afterEach(() => {
    if (idCriado) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/vehicles/' + idCriado + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idCriado = null;
    }
  });

  it('cancelar na confirmação de criação NÃO envia o veículo', () => {
    cy.intercept('POST', '**/vehicles').as('criarVeiculo');
    cy.entrar('gerente');
    cy.visit('/fleet/vehicles/new');
    cy.get('#campo-veiculo-placa').type(placaCriada);
    cy.get('#campo-veiculo-modelo').type('Fiat Strada Endurance');
    cy.get('#campo-veiculo-ano').clear().type('2023');
    cy.get('#botao-salvar-veiculo').click();
    cy.get('#botao-cancelar-modal').click();
    cy.get('@criarVeiculo.all').should('have.length', 0);
  });

  it('confirmar cria o veículo, depois exclui (soft), restaura e só o ADMIN apaga de vez', () => {
    cy.intercept('POST', '**/vehicles').as('criarVeiculo');
    cy.entrar('gerente');
    cy.visit('/fleet/vehicles/new');
    cy.get('#campo-veiculo-placa').type(placaCriada);
    cy.get('#campo-veiculo-modelo').type('Fiat Strada Endurance');
    cy.get('#campo-veiculo-ano').clear().type('2023');
    cy.get('#botao-salvar-veiculo').click();
    cy.get('#botao-confirmar').click();
    cy.wait('@criarVeiculo').then((intercepcao) => {
      idCriado = intercepcao.response?.body.id ?? null;
    });

    // Soft delete: cancelar não exclui, confirmar exclui.
    cy.visit('/fleet/vehicles');
    cy.get('[data-id="' + idCriado + '"] [data-acao="excluir"]').click();
    cy.get('#botao-cancelar-modal').click();
    cy.get('[data-id="' + idCriado + '"]').should('exist');

    cy.get('[data-id="' + idCriado + '"] [data-acao="excluir"]').click();
    cy.get('#botao-confirmar').click();
    cy.get('[data-id="' + idCriado + '"]', { timeout: 10000 }).should('not.exist');

    // Aba Removidos e restaurar.
    cy.get('#aba-removidos').click();
    cy.get('[data-id="' + idCriado + '"]', { timeout: 10000 }).should('exist');
    cy.get('[data-id="' + idCriado + '"] [data-acao="restaurar"]').click();
    cy.get('#botao-confirmar').click();
    cy.get('[data-id="' + idCriado + '"]', { timeout: 10000 }).should('not.exist');

    // Gerente não tem exclusão definitiva; só o ADMIN vê e usa esse botão.
    cy.get('#aba-ativos').click();
    cy.get('[data-id="' + idCriado + '"] [data-acao="excluir-definitivo"]').should('not.exist');

    cy.entrar('admin');
    cy.visit('/fleet/vehicles');
    cy.get('[data-id="' + idCriado + '"] [data-acao="excluir-definitivo"]').click();
    cy.get('#botao-confirmar').click();
    cy.get('[data-id="' + idCriado + '"]', { timeout: 10000 }).should('not.exist');
    idCriado = null;
  });
});
