// O menu lateral muda de acordo com o papel logado (permissions efetivas).
describe('Menu por papel', () => {
  it('motorista vê Dashboard, Frota, Viagens, Abastecimentos e Incidentes, sem Usuários', () => {
    cy.entrar('motorista');
    cy.visit('/dashboard');
    cy.get('#menu-principal a[data-item]').should('have.length', 5);
    cy.get('[data-item="usuarios"]').should('not.exist');
    cy.get('[data-item="manutencao"]').should('not.exist');
  });

  it('gerente vê Manutenção, Analytics e Novo usuário, mas não a lista de Usuários', () => {
    cy.entrar('gerente');
    cy.visit('/dashboard');
    cy.get('[data-item="manutencao"]').should('exist');
    cy.get('[data-item="analytics"]').should('exist');
    cy.get('[data-item="novo-usuario"]').should('exist');
    cy.get('[data-item="usuarios"]').should('not.exist');
  });

  it('administrador vê o menu completo, incluindo Usuários', () => {
    cy.entrar('admin');
    cy.visit('/dashboard');
    cy.get('[data-item="usuarios"]').should('exist');
    cy.get('#menu-principal a[data-item]').should('have.length', 9);
  });
});
