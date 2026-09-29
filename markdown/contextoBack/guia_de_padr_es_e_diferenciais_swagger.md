# Guia de Padronização e Boas Práticas para Documentação Swagger / OpenAPI

Este documento define as diretrizes para a construção de documentações de API utilizando o padrão OpenAPI (Swagger). O objetivo é garantir consistência, alta qualidade e uma excelente Experiência do Desenvolvedor (DX), além de facilitar a rastreabilidade entre a camada de API e o banco de dados.

---

## 1. Requisitos Padrão (Essenciais)

Estes itens representam o nível mínimo aceitável para qualquer API em produção.

* **Informações Globais do Serviço (`info`):**
  * Título claro e objetivo do serviço.
  * Versão semântica (ex: `1.0.0`).
  * Descrição sucinta da finalidade do serviço.
* **Rotas e Métodos HTTP (`paths`):**
  * Mapeamento completo dos endpoints com seus respectivos verbos (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`).
* **Parâmetros de Entrada (`parameters` / `requestBody`):**
  * Tipos de dados explícitos (`string`, `integer`, `boolean`, `array`).
  * Localização clara (`path`, `query`, `header` ou `body`).
  * Indicação explicita de obrigatoriedade (`required: true/false`).
* **Respostas HTTP Fundamentais (`responses`):**
  * Status codes padrão de sucesso (`200 OK`, `201 Created`, `204 No Content`).
  * Status codes de erro básicos (`400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `500 Internal Server Error`).
* **Modelos de Dados Reutilizáveis (`components/schemas`):**
  * Declaração de objetos reutilizáveis para evitar duplicação no contrato.
* **Esquema de Autenticação (`securitySchemes`):**
  * Definição explícita do método de segurança utilizado (ex: Bearer JWT, API Key, OAuth2).

---

## 2. Requisitos Diferenciais (Alta Qualidade / DX)

Recursos que elevam o nível da documentação, aceleram a integração e reduzem chamadas de suporte.

* **Exemplos Reais e Dinâmicos (`examples`):**
  * Substituição de valores genéricos (`string`, `0`) por dados fiéis ao domínio de negócio.
  * Inclusão de múltiplos cenários para a mesma rota (ex: Payload completo vs. Payload mínimo).
* **Tratamento de Erros Padronizado (RFC 7807):**
  * Retorno de erros estruturados no padrão **Problem Details** (`type`, `title`, `status`, `detail`, `instance`, `invalid_params`).
* **Metadados de Paginação, Filtro e Ordenação:**
  * Documentação explicita de parâmetros `page`, `limit`, `sort` e headers de contagem total (`X-Total-Count`).
* **Gargalos e Limites de Uso (Rate Limit):**
  * Indicação dos cabeçalhos de resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `Retry-After`.
* **Configuração de Múltiplos Ambientes (`servers`):**
  * Inclusão de URLs configuráveis para ambintes de Desenvolvimento, Staging/Sandbox e Produção.
* **Depreciação Transparente (`deprecated`):**
  * Sinalização de rotas legadas com aviso explícito da data de remoção e rota substituta.
* **Navegação Encadeada (OpenAPI Links):**
  * Conexão entre respostas de criação/atualização e as rotas de consulta correspondentes.

---

## 3. Mapeamento de Banco de Dados por Rota

Para melhorar o alinhamento entre a equipe de desenvolvimento, arquitetura e DBA/Data Engineers, **cada endpoint deve documentar a(s) tabela(s) do banco de dados que consulta ou altera.**

### Como Documentar

1. **Através de Extensões Customizadas do OpenAPI (`x-database-tables`):**
   Uso da chave proprietária `x-database-tables` no nível da operação para consumo automatizado por ferramentas internas, linters ou geradores de documentação.
2. **Na Descrição da Rota em Markdown:**
   Exibição visual legível no painel do Swagger UI destacando as operações no banco.

### Categorização das Operações
* **Leitura:** Indica quais tabelas e visões (`views`) são consultadas (`SELECT`).
* **Escrita/Alteração:** Indica quais tabelas sofrem mutação (`INSERT`, `UPDATE`, `DELETE`).

---

## 4. Exemplo Prático de Especificação (YAML)

Abaixo está um exemplo de rota que aplica os conceitos padrão, diferenciais e o mapeamento de tabelas:

```yaml
openapi: 3.0.3
info:
  title: API de Gestão de Pedidos
  description: Serviço responsável pelo processamento e consulta de pedidos de vendas.
  version: 1.2.0

servers:
  - url: https://api.empresa.com/v1
    description: Ambiente de Produção
  - url: https://sandbox-api.empresa.com/v1
    description: Ambiente de Testes / Sandbox

paths:
  /pedidos/{id}:
    get:
      summary: Busca detalhes de um pedido
      description: |
        Retorna os dados completos de um pedido existente no sistema.
        
        **Impacto em Banco de Dados:**
        * **Tabelas Consultadas:** `tb_pedidos`, `tb_itens_pedido`, `tb_clientes`
      
      # Extensão customizada para mapeamento de tabelas (para auditoria/linters)
      x-database-tables:
        read:
          - tb_pedidos
          - tb_itens_pedido
          - tb_clientes
        write: []

      parameters:
        - name: id
          in: path
          required: true
          description: Identificador único do pedido (UUID v4)
          schema:
            type: string
            format: uuid
          example: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"

      responses:
        '200':
          description: Pedido localizado com sucesso.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PedidoResponse'
              examples:
                pedido_completo:
                  summary: Exemplo de Pedido Aprovado
                  value:
                    id: "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
                    cliente_id: "usr_99812"
                    status: "APROVADO"
                    valor_total: 250.50
                    criado_em: "2026-03-20T14:30:00Z"
                    itens:
                      - produto_id: "prod_001"
                        quantidade: 2
                        preco_unitario: 125.25

        '404':
          description: Pedido não encontrado.
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetails'
              example:
                type: "https://api.empresa.com/erros/pedido-nao-encontrado"
                title: "Recurso não encontrado"
                status: 404
                detail: "O pedido 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6' não foi localizado em nossa base."
                instance: "/pedidos/f81d4fae-7dec-11d0-a765-00a0c91e6bf6"

    put:
      summary: Atualiza status do pedido
      description: |
        Atualiza o status de processamento do pedido.
        
        **Impacto em Banco de Dados:**
        * **Tabelas Alteradas:** `tb_pedidos`
        * **Tabelas Consultadas:** `tb_pedidos`
      
      x-database-tables:
        read:
          - tb_pedidos
        write:
          - tb_pedidos

      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid

      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - status
              properties:
                status:
                  type: string
                  enum: [PENDENTE, APROVADO, CANCELADO, ENTREGUE]
                  example: "CANCELADO"
                motivo:
                  type: string
                  example: "Solicitação do cliente antes do envio."

      responses:
        '200':
          description: Status atualizado com sucesso.
        '400':
          description: Transição de status inválida.

components:
  schemas:
    PedidoResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        cliente_id:
          type: string
        status:
          type: string
        valor_total:
          type: number
          format: float
        criado_em:
          type: string
          format: date-time
        itens:
          type: array
          items:
            type: object
            properties:
              produto_id:
                type: string
              quantidade:
                type: integer
              preco_unitario:
                type: number

    ProblemDetails:
      type: object
      properties:
        type:
          type: string
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
```

---

## 5. Checklist de Revisão da Documentação

Antes de aprovar o Pull Request de uma documentação OpenAPI, certifique-se de validar:

- [ ] A API possui título, versão e descrição adequados.
- [ ] Todas as rotas possuem códigos de erro e sucesso esperados.
- [ ] Os dados de exemplo refletem o domínio real da aplicação.
- [ ] Erros seguem uma estrutura padronizada (ex: RFC 7807).
- [ ] A seção de descrição ou `x-database-tables` de **todas** as rotas identifica claramente as tabelas consultadas ou alteradas.
- [ ] Schemas complexos utilizam `$ref` e estão definidos na seção `components`.