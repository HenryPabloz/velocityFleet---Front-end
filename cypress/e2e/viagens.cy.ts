// Fluxo completo de uma viagem: criar, iniciar, finalizar (modal de km) e a regra OWN do motorista.
describe('Viagens', () => {
  let sufixo: string;
  let idViagemCriada: string | null = null;

  before(() => {
    cy.sufixoUnico().then((valor) => (sufixo = valor));
  });

  afterEach(() => {
    // Limpeza: exclusão definitiva pela API com JWT de ADMIN, se a viagem chegou a ser criada.
    if (idViagemCriada) {
      cy.jwtAdmin().then((token) => {
        cy.request({
          method: 'DELETE',
          url: Cypress.env('apiUrl') + '/trips/' + idViagemCriada + '/permanent',
          headers: { Authorization: 'Bearer ' + token },
          failOnStatusCode: false,
        });
      });
      idViagemCriada = null;
    }
  });

  it('motorista cria, inicia e finaliza a própria viagem (São Paulo → Belo Horizonte)', () => {
    cy.entrar('motorista');
    cy.visit('/trips/new');

    cy.get('#campo-viagem-veiculo').type('RIO4E56{enter}', { force: true });
    cy.get('#campo-viagem-cep-origem').type('01310100');
    cy.get('#campo-viagem-cep-destino').type('30130010');
    cy.get('#botao-criar-viagem').click();

    // Confirmação (pop-up) antes de enviar.
    cy.get('#botao-confirmar').click();

    cy.url({ timeout: 15000 }).should('match', /\/trips\/[0-9a-f-]{36}$/);
    cy.url().then((url) => {
      idViagemCriada = url.split('/trips/')[1];
    });

    cy.get('#botao-iniciar-viagem').click();
    cy.get('#botao-confirmar').click();
    cy.get('#andamento-viagem', { timeout: 10000 }).should('contain.text', 'Em andamento');

    cy.get('#botao-finalizar-viagem').click();
    cy.get('#campo-km-rodados').type('586');
    cy.get('#campo-local-final').type('Praça Sete de Setembro, Centro, Belo Horizonte - MG');
    cy.get('#botao-confirmar-finalizar').click();

    cy.get('#andamento-viagem', { timeout: 10000 }).should('contain.text', 'Concluída');
    cy.get('#distancia-viagem').should('contain.text', '586');
  });

  it('motorista tentando abrir a viagem de outro motorista vê "Viagem não encontrada"', () => {
    // Uma viagem criada pelo gerente para outro motorista (regra OWN esconde de quem não é dono).
    cy.entrar('gerente');
    cy.visit('/trips/new');
    cy.get('#campo-viagem-motorista').type('{selectall}', { force: true });
    cy.get('#campo-viagem-motorista').type('Juliana Souza Barbosa{enter}', { force: true });
    cy.get('#campo-viagem-veiculo').type('BRA2E19{enter}', { force: true });
    cy.get('#campo-viagem-cep-origem').type('01310100');
    cy.get('#campo-viagem-cep-destino').type('30130010');
    cy.get('#botao-criar-viagem').click();
    cy.get('#botao-confirmar').click();

    cy.url({ timeout: 15000 }).then((url) => {
      const idDaViagemAlheia = url.split('/trips/')[1];
      idViagemCriada = idDaViagemAlheia;

      cy.entrar('motorista');
      cy.visit('/trips/' + idDaViagemAlheia);
      cy.get('#alerta-erro-negocio', { timeout: 10000 }).should('contain.text', 'Viagem não encontrada');
    });
  });
});
