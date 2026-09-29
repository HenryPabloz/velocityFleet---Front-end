# 🔍 Verificação Geral do Projeto - Segurança, Autenticação e Validações

## 📋 Índice

1. [Checklist de Verificação](#checklist-de-verificação)
2. [Soft Delete e Reativação](#soft-delete-e-reativação)
3. [Validação de Email Duplicado](#validação-de-email-duplicado)
4. [Normalização e Validações](#normalização-e-validações)
5. [Implementação de Interceptors](#implementação-de-interceptors)
6. [Atualização de Documentação](#atualização-de-documentação)

---

## ✅ Checklist de Verificação

### 1. Soft Delete e Reativação

- [ ] Campo `deletedAt` ou `deletedDate` existe nas models de usuários
- [ ] Campo `deletedAt` ou `deletedDate` existe nas models de veículos
- [ ] Existe rota para reativar usuário (PATCH/PUT `/users/:id/reactivate`)
- [ ] Existe rota para reativar veículo (PATCH/PUT `/vehicles/:id/reactivate`)
- [ ] Queries filtram registros deletados (WHERE deletedAt IS NULL)
- [ ] Rota de reativação remove o campo `deletedAt` ou o seta como NULL
- [ ] Testes de soft delete incluem reativação

**Status:** ⚠️ A verificar no projeto

---

### 2. Fluxo de Autenticação

- [ ] Rota POST `/auth/register` é **pública** (sem autenticação)
- [ ] Registro cria um `api_key` único para o usuário
- [ ] Rota POST `/auth/login` aceita email + api_key (sem JWT ainda)
- [ ] Login retorna JWT token com expiração
- [ ] JWT contém: `userId`, `role`, `iat`, `exp`
- [ ] Rotas protegidas verificam presença do JWT
- [ ] Erro 401 quando token ausente ou inválido
- [ ] Erro 403 quando usuário sem permissão

**Status:** ⚠️ A verificar no projeto

---

### 3. Documentação Swagger com Roles

- [ ] Cada endpoint possui tag de documentação
- [ ] Swagger especifica qual role pode acessar
- [ ] Endpoints públicos marcados como públicos no Swagger
- [ ] Endpoints privados mostram requisito de autenticação
- [ ] Erros 401/403 documentados

**Status:** ⚠️ A verificar no projeto

---

### 4. Validação de Email Duplicado (Case Sensitive)

- [ ] Email é convertido para lowercase antes de salvar
- [ ] Email é trimmed antes de salvar
- [ ] Busca de email usa lowercase (WHERE LOWER(email) = LOWER(?))
- [ ] Validação ocorre antes de INSERT/UPDATE
- [ ] Retorna erro 409 Conflict se email já existe
- [ ] Mensagem de erro clara: "Email já cadastrado"

**Exemplo de implementação:**
```javascript
// Antes de salvar
const email = req.body.email.trim().toLowerCase();

// Buscar existente
const usuarioExistente = await Usuario.findOne({
  where: sequelize.where(
    sequelize.fn('LOWER', sequelize.col('email')),
    '=',
    email
  )
});

if (usuarioExistente) {
  return res.status(409).json({ error: 'Email já cadastrado' });
}
```

**Status:** ⚠️ A verificar no projeto

---

### 5. Normalização e Validações

#### 5.1 CNH (Carteira Nacional de Habilitação)

- [ ] **Comprimento:** Exatamente 11 dígitos
- [ ] **Formato:** Apenas números
- [ ] **Regex válido:**
  ```regex
  /^\d{11}$/
  ```
- [ ] **Validação:**
  ```javascript
  const cnh = String(req.body.cnh).trim();
  if (!/^\d{11}$/.test(cnh)) {
    return res.status(400).json({ 
      error: 'CNH deve conter exatamente 11 dígitos' 
    });
  }
  ```

#### 5.2 Email

- [ ] **Regex padrão RFC 5322 simplificado:**
  ```regex
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  ```
- [ ] **OU regex mais rigoroso:**
  ```regex
  /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  ```
- [ ] **Validação:**
  ```javascript
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(req.body.email)) {
    return res.status(400).json({ 
      error: 'Email inválido' 
    });
  }
  ```
- [ ] Já convertido para lowercase
- [ ] Trimmed

#### 5.3 Placa de Veículo (Brasil)

- [ ] **Formato Mercosul (2018+):** AAAA000 (4 letras + 3 números)
- [ ] **Formato Antigo:** AAA-0000 (3 letras + 4 números)
- [ ] **Regex Mercosul:**
  ```regex
  /^[A-Z]{4}\d{3}$/
  ```
- [ ] **Regex Antigo:**
  ```regex
  /^[A-Z]{3}-?\d{4}$/
  ```
- [ ] **Regex Combinado:**
  ```regex
  /^([A-Z]{4}\d{3}|[A-Z]{3}-?\d{4})$/
  ```
- [ ] **Validação:**
  ```javascript
  const placaRegex = /^([A-Z]{4}\d{3}|[A-Z]{3}-?\d{4})$/;
  const placa = String(req.body.placa).toUpperCase().trim();
  
  if (!placaRegex.test(placa)) {
    return res.status(400).json({ 
      error: 'Placa inválida. Use: AAAA000 ou AAA-0000' 
    });
  }
  ```
- [ ] Convertida para uppercase
- [ ] Trimmed

#### 5.4 Data

- [ ] **Formato ISO 8601:** YYYY-MM-DD
- [ ] **Validação de data válida:**
  ```javascript
  const data = new Date(req.body.data);
  if (isNaN(data.getTime())) {
    return res.status(400).json({ 
      error: 'Data inválida' 
    });
  }
  ```


**Status:** ⚠️ A verificar no projeto

---

## 🔄 Soft Delete e Reativação

### Implementação no Model

```javascript
// models/Usuario.js (Sequelize)
module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define('Usuario', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    // Usar paranoid soft delete automaticamente (Sequelize)
    paranoid: true,
    timestamps: true
  });

  return Usuario;
};
```

### Rota de Soft Delete

```javascript
// routes/usuariosRoutes.js
router.delete('/usuarios/:id', autenticado, autorizadoAdmin, async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Soft delete - Sequelize faz automaticamente
    await usuario.destroy();

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Rota de Reativação

```javascript
// routes/usuariosRoutes.js
router.patch('/usuarios/:id/reactivate', autenticado, autorizadoAdmin, async (req, res) => {
  try {
    // Para restaurar com Sequelize paranoid
    const usuario = await Usuario.findByPk(req.params.id, {
      paranoid: false  // Inclui registros deletados
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!usuario.deletedAt) {
      return res.status(400).json({ error: 'Usuário já está ativo' });
    }

    // Restaurar
    await usuario.restore();

    res.json({ 
      message: 'Usuário reativado com sucesso',
      usuario 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Queries que filtram deletados

```javascript
// Sequelize automaticamente filtra paranoid: true
const usuarios = await Usuario.findAll();  // Sem deletados

// Forçar incluir deletados
const usuariosComDeletados = await Usuario.findAll({
  paranoid: false
});

// Apenas deletados
const usuariosDeletados = await Usuario.findAll({
  paranoid: false,
  where: {
    deletedAt: { [Op.ne]: null }
  }
});
```

---

## 🚫 Validação de Email Duplicado (Case Insensitive)

### Classe Validadora

```javascript
// utils/validadores.js

class ValidadorEmail {
  static normalizarEmail(email) {
    return email.trim().toLowerCase();
  }

  static async verificarDuplicado(email, usuarioIdExcluir = null) {
    const emailNormalizado = this.normalizarEmail(email);

    const query = {
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        '=',
        emailNormalizado
      )
    };

    // Excluir usuário atual ao atualizar
    if (usuarioIdExcluir) {
      query.where = {
        ...query.where,
        id: { [Op.ne]: usuarioIdExcluir }
      };
    }

    const usuarioExistente = await Usuario.findOne(query);
    return usuarioExistente !== null;
  }

  static validarFormato(email) {
    const regex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
  }
}

module.exports = ValidadorEmail;
```

### Middleware de Validação

```javascript
// middlewares/validarEmail.js
const ValidadorEmail = require('../utils/validadores');

const validarEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Validar formato
    if (!ValidadorEmail.validarFormato(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Verificar duplicação
    const usuarioIdExcluir = req.params.id; // Para UPDATEs
    const jáExiste = await ValidadorEmail.verificarDuplicado(
      email,
      usuarioIdExcluir
    );

    if (jáExiste) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Normalizar e continuar
    req.body.email = ValidadorEmail.normalizarEmail(email);
    next();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validarEmail;
```

### Uso nas Rotas

```javascript
// routes/usuariosRoutes.js
const validarEmail = require('../middlewares/validarEmail');

// Criar usuário
router.post('/usuarios', validarEmail, async (req, res) => {
  const usuario = await Usuario.create(req.body);
  res.status(201).json(usuario);
});

// Atualizar usuário
router.put('/usuarios/:id', validarEmail, async (req, res) => {
  const usuario = await Usuario.findByPk(req.params.id);
  await usuario.update(req.body);
  res.json(usuario);
});
```

---

## ✔️ Normalização e Validações

### Classe Validadora Geral

```javascript
// utils/validadores.js

class Validador {
  // CNH - 11 dígitos
  static validarCNH(cnh) {
    const cnhLimpa = String(cnh).trim();
    return /^\d{11}$/.test(cnhLimpa);
  }

  // Email
  static validarEmail(email) {
    const emailTrimmed = String(email).trim();
    return /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailTrimmed);
  }

  // Placa Veículo (Mercosul ou Antigo)
  static validarPlaca(placa) {
    const placaTrimmed = String(placa).trim().toUpperCase();
    return /^([A-Z]{4}\d{3}|[A-Z]{3}-?\d{4})$/.test(placaTrimmed);
  }

  // Data Válida
  static validarData(data) {
    const d = new Date(data);
    return !isNaN(d.getTime());
  }



  // Normalizar string
  static normalizarString(valor, minuscula = false) {
    let normalizado = String(valor).trim();
    if (minuscula) {
      normalizado = normalizado.toLowerCase();
    }
    return normalizado;
  }
}

module.exports = Validador;
```

### Middleware de Validação Global

```javascript
// middlewares/validarDados.js
const Validador = require('../utils/validadores');

const validarDadosVeiculo = (req, res, next) => {
  const erros = [];

  // Validar placa
  if (req.body.placa && !Validador.validarPlaca(req.body.placa)) {
    erros.push('Placa inválida. Use: AAAA000 ou AAA-0000');
  }

  // Validar CNH
  if (req.body.cnh && !Validador.validarCNH(req.body.cnh)) {
    erros.push('CNH deve conter exatamente 11 dígitos');
  }

  // Validar data
  if (req.body.dataFabricacao && !Validador.validarData(req.body.dataFabricacao)) {
    erros.push('Data de fabricação inválida');
  }

  if (erros.length > 0) {
    return res.status(400).json({ erros });
  }

  // Normalizar dados
  if (req.body.placa) {
    req.body.placa = String(req.body.placa).trim().toUpperCase();
  }

  next();
};

module.exports = validarDadosVeiculo;
```

---

## 🔌 Implementação de Interceptors

### 1. Interceptor de Injeção de Token (Bearer Token)

```javascript
// utils/httpClient.js ou services/apiClient.js

class APIClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token') || null;
  }

  /**
   * Interceptor de Request
   * Adiciona Bearer Token no header automaticamente
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    // Adicionar headers padrão
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Injetar token se disponível
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  }

  async get(endpoint) {
    const response = await this.fetch(endpoint, { method: 'GET' });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async put(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async patch(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    const response = await this.fetch(endpoint, { method: 'DELETE' });
    return this.handleResponse(response);
  }

  async handleResponse(response) {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw {
        status: response.status,
        statusText: response.statusText,
        data
      };
    }

    return data;
  }
}

export const api = new APIClient();
```

### Uso do Interceptor

```javascript
// Qualquer arquivo da aplicação

import { api } from './services/apiClient';

// Login
const login = async (email, apiKey) => {
  try {
    const response = await api.post('/auth/login', { email, apiKey });
    api.setToken(response.token); // Token automaticamente adicionado
    return response;
  } catch (error) {
    console.error('Login falhou:', error);
  }
};

// Requisição GET com token automaticamente injetado
const buscarUsuarios = async () => {
  try {
    const usuarios = await api.get('/usuarios');
    // Header Authorization foi adicionado automaticamente
    return usuarios;
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
  }
};

// Criar usuário com token automaticamente injetado
const criar = async (dados) => {
  try {
    const usuario = await api.post('/usuarios', dados);
    return usuario;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
  }
};
```

---

### 2. Interceptor de Refresh Token

```javascript
// utils/httpClient.js - Versão com Refresh Token

class APIClientComRefresh {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token') || null;
    this.refreshToken = localStorage.getItem('refreshToken') || null;
    this.fila = []; // Fila de requisições que falharam
    this.tentandoRenovar = false;
  }

  setTokens(token, refreshToken) {
    this.token = token;
    this.refreshToken = refreshToken;
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Se receber 401, tentar renovar token
    if (response.status === 401 && this.refreshToken) {
      response = await this.handleUnauthorized(url, options, headers);
    }

    return response;
  }

  async handleUnauthorized(url, options, headers) {
    // Se já está tentando renovar, adicionar à fila
    if (this.tentandoRenovar) {
      return new Promise((resolve) => {
        this.fila.push(() => {
          // Adicionar novo token ao header
          headers['Authorization'] = `Bearer ${this.token}`;
          resolve(fetch(url, { ...options, headers }));
        });
      });
    }

    this.tentandoRenovar = true;

    try {
      // Renovar token usando refresh token
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) {
        throw new Error('Falha ao renovar token');
      }

      const data = await response.json();

      // Atualizar tokens
      this.setTokens(data.token, data.refreshToken);

      // Atualizar header e repetir requisição original
      headers['Authorization'] = `Bearer ${this.token}`;

      // Processar fila de requisições
      const novasRespostas = this.fila.splice(0, this.fila.length);
      novasRespostas.forEach(callback => callback());

      // Repetir requisição original
      return fetch(url, { ...options, headers });

    } catch (error) {
      console.error('Erro ao renovar token:', error);
      // Fazer logout (limpar tokens)
      this.logout();
      // Redirecionar para login
      window.location.href = '/login';
      throw error;
    } finally {
      this.tentandoRenovar = false;
    }
  }

  logout() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this.fila = [];
  }

  async get(endpoint) {
    const response = await this.fetch(endpoint, { method: 'GET' });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  // ... outros métodos HTTP

  async handleResponse(response) {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw {
        status: response.status,
        statusText: response.statusText,
        data
      };
    }

    return data;
  }
}

export const api = new APIClientComRefresh();
```

### Rota de Refresh Token (Backend)

```javascript
// routes/authRoutes.js

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar JWT Token
 *     description: Usa Refresh Token para obter novo Access Token
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *       401:
 *         description: Refresh Token inválido ou expirado
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh Token obrigatório' });
    }

    // Verificar Refresh Token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    // Buscar usuário
    const usuario = await Usuario.findByPk(decoded.userId);

    if (!usuario) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    // Gerar novo Access Token
    const novoToken = jwt.sign(
      {
        userId: usuario.id,
        email: usuario.email,
        role: usuario.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: novoToken,
      refreshToken: refreshToken // Ou gerar novo também
    });

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh Token expirado' });
    }
    res.status(401).json({ error: 'Refresh Token inválido' });
  }
});
```

---

### 3. Interceptor de Logs e Auditoria

```javascript
// middlewares/logging.js

const fs = require('fs');
const path = require('path');

class LoggerAuditoria {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.criarDiretorioSeNaoExiste();
  }

  criarDiretorioSeNaoExiste() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  pegarNomeArquivoLog() {
    const hoje = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `auditoria-${hoje}.log`);
  }

  registrarLog(dados) {
    const timestamp = new Date().toISOString();
    const linha = `${timestamp} | ${JSON.stringify(dados)}\n`;

    fs.appendFileSync(this.pegarNomeArquivoLog(), linha);
  }

  middleware() {
    return (req, res, next) => {
      const inicio = Date.now();

      // Interceptar response
      const respuestaOriginal = res.json;
      res.json = function(data) {
        const duracao = Date.now() - inicio;
        const statusCode = res.statusCode;

        // Log de auditoria
        const logData = {
          metodo: req.method,
          rota: req.originalUrl,
          ip: req.ip,
          usuario: req.usuario?.userId || 'anonimo',
          statusCode,
          duracao: `${duracao}ms`,
          timestamp: new Date().toISOString(),
          descricao: `${req.method} ${req.originalUrl} - ${statusCode}`
        };

        this.registrarLog(logData);

        return respuestaOriginal.call(this, data);
      }.bind(this);

      next();
    };
  }

  registrarErro(req, erro) {
    const logData = {
      tipo: 'ERRO',
      metodo: req.method,
      rota: req.originalUrl,
      usuario: req.usuario?.userId || 'anonimo',
      erro: erro.message,
      stack: erro.stack,
      timestamp: new Date().toISOString()
    };

    this.registrarLog(logData);
  }

  registrarLogin(usuario, sucesso) {
    const logData = {
      tipo: 'LOGIN',
      usuario: usuario.email,
      sucesso,
      timestamp: new Date().toISOString()
    };

    this.registrarLog(logData);
  }

  registrarAcao(usuario, acao, recurso, detalhes = {}) {
    const logData = {
      tipo: 'ACAO',
      usuario: usuario.id,
      acao,
      recurso,
      detalhes,
      timestamp: new Date().toISOString()
    };

    this.registrarLog(logData);
  }
}

module.exports = new LoggerAuditoria();
```

### Uso do Logger

```javascript
// app.js
const logger = require('./middlewares/logging');

// Aplicar middleware de logging
app.use(logger.middleware());

// routes/authRoutes.js
router.post('/login', async (req, res) => {
  try {
    const { email, apiKey } = req.body;

    // ... validações ...

    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario || usuario.apiKey !== apiKey) {
      logger.registrarLogin({ email }, false);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    logger.registrarLogin(usuario, true);

    // ... gerar tokens ...
  } catch (error) {
    logger.registrarErro(req, error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar ações importantes
router.post('/usuarios', async (req, res) => {
  try {
    const novoUsuario = await Usuario.create(req.body);
    
    logger.registrarAcao(
      req.usuario,
      'CRIAR',
      'USUARIO',
      { usuarioId: novoUsuario.id }
    );

    res.status(201).json(novoUsuario);
  } catch (error) {
    logger.registrarErro(req, error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/usuarios/:id', autenticado, autorizador(['admin']), async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await usuario.destroy();

    logger.registrarAcao(
      req.usuario,
      'DELETAR',
      'USUARIO',
      { usuarioDeletadoId: req.params.id }
    );

    res.json({ message: 'Usuário deletado' });
  } catch (error) {
    logger.registrarErro(req, error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📖 Atualização de Documentação

### 1. README.md - Adicionar Seção de Segurança

```markdown
## 🔐 Segurança e Autenticação

### Fluxo de Autenticação

1. **Registro (Público)**
   - POST `/auth/register`
   - Sem autenticação obrigatória
   - Retorna: `apiKey`

2. **Login**
   - POST `/auth/login`
   - Envia: email + apiKey
   - Retorna: `token` (JWT 24h) + `refreshToken` (7 dias)

3. **Requisições Autenticadas**
   - Header: `Authorization: Bearer <token>`
   - Token é validado automaticamente pelos interceptors

4. **Renovação de Token**
   - POST `/auth/refresh`
   - Envia: `refreshToken`
   - Interceptor automático ao receber 401

### Acesso por Role

| Função | Descrição | Acesso |
|--------|-----------|--------|
| **usuario** | Usuário comum | Seus próprios dados |
| **admin** | Administrador | Todos os dados, gerenciamento de usuários |

### Validações Implementadas

- ✅ Email: formato válido + case-insensitive + único
- ✅ CNH: 11 dígitos
- ✅ Placa: AAAA000 ou AAA-0000
- ✅ Telefone: (XX) 9XXXX-XXXX
- ✅ CPF: 11 dígitos com validação de dígito verificador
- ✅ Datas: formato ISO 8601

### Soft Delete

Usuários e veículos com `deletedAt` podem ser:
- Reativados via: PATCH `/usuarios/:id/reactivate`
- Consultados incluindo deletados: `paranoid: false`
```

### 2. Criar SECURITY.md

```markdown
# 🔐 Guia de Segurança da API

## Autenticação e Autorização

### Fluxo Recomendado

1. Registre um novo usuário em `/auth/register`
2. Você receberá uma `apiKey`
3. Use a `apiKey` em `/auth/login` para obter o JWT `token`
4. Adicione o token em todas as requisições: `Authorization: Bearer <token>`
5. Se receber 401, use o `refreshToken` para renovar

### Exemplo de Fluxo

```bash
# 1. Registrar
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"João","email":"joao@example.com","senha":"senha123"}'

# Resposta: { "apiKey": "abc123..." }

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@example.com","apiKey":"abc123..."}'

# Resposta: { "token": "eyJh...", "refreshToken": "..." }

# 3. Usar Token
curl -X GET http://localhost:3000/usuarios \
  -H "Authorization: Bearer eyJh..."
```

## Boas Práticas

1. **Nunca compartilhe sua API Key**
2. **Guarde o JWT em localStorage/sessionStorage de forma segura**
3. **Implemente Refresh Token automaticamente**
4. **Use HTTPS em produção**
5. **Configure CORS adequadamente**
6. **Valide todos os inputs**
7. **Use rate limiting**
8. **Mantenha logs de auditoria**

## Endpoints Públicos

- POST `/auth/register` - Qualquer pessoa
- POST `/auth/login` - Com apiKey válida
- POST `/auth/refresh` - Com refreshToken válido

## Endpoints Protegidos

Todos os outros endpoints requerem JWT válido no header:
```
Authorization: Bearer <seu_token_jwt>
```

## Validações de Entrada

Todas as entradas são validadas:
- Emails: formato válido, case-insensitive, único
- CNH: 11 dígitos
- Placa: formato Mercosul ou antigo
- Datas: ISO 8601
- Strings: comprimento mínimo/máximo

## Tratamento de Erros

- **400**: Validação falhou
- **401**: Token inválido ou expirado
- **403**: Sem permissão para acessar
- **409**: Recurso já existe (ex: email duplicado)
- **500**: Erro no servidor
```

### 3. Criar AUTH.md

```markdown
# 🔑 Documentação de Autenticação

## Endpoints de Autenticação

### 1. Registrar Novo Usuário

**POST** `/auth/register`

Endpoint **público** - não requer autenticação.

**Request Body:**
```json
{
  "nome": "João Silva",
  "email": "joao@example.com",
  "senha": "senha123"
}
```

**Response (201):**
```json
{
  "message": "Usuário registrado com sucesso",
  "apiKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "instruction": "Use esta API Key para fazer login"
}
```

**Validações:**
- Nome: 3-255 caracteres
- Email: formato válido, único
- Senha: mínimo 8 caracteres

---

### 2. Fazer Login

**POST** `/auth/login`

Endpoint **público** - requer apiKey.

**Request Body:**
```json
{
  "email": "joao@example.com",
  "apiKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "nome": "João Silva",
    "email": "joao@example.com",
    "role": "usuario"
  }
}
```

**Errors:**
- 401: Credenciais inválidas

---

### 3. Renovar Token

**POST** `/auth/refresh`

Endpoint **público** - usa refreshToken.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- 401: Refresh Token expirado ou inválido

---

## Usando o JWT Token

Adicione o token em todas as requisições:

```
Authorization: Bearer <seu_token>
```

### Exemplo com cURL

```bash
curl -X GET http://localhost:3000/usuarios \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Exemplo com Fetch

```javascript
const resposta = await fetch('http://localhost:3000/usuarios', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Exemplo com Axios

```javascript
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

---

## Estrutura do JWT Token

O JWT contém as seguintes claims:

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "email": "joao@example.com",
  "role": "usuario",
  "iat": 1693497600,
  "exp": 1693584000
}
```

- **userId**: ID único do usuário
- **email**: Email do usuário
- **role**: Função do usuário (usuario, admin)
- **iat**: Emitido em (timestamp)
- **exp**: Expira em (timestamp) - 24 horas após emissão

---

## Interceptor de Token (Frontend)

O cliente automaticamente:

1. Adiciona o token no header de todas as requisições
2. Captura erros 401
3. Usa o refreshToken para renovar
4. Repete a requisição automaticamente
5. Redireciona para login se ambos expirarem

Não é necessário gerenciar tokens manualmente em cada requisição!
```

### 4. Atualizar swagger.yaml/json

```yaml
# swagger.yaml ou em comentários nos controllers

openapi: 3.0.0
info:
  title: API de Gestão
  version: 1.0.0
servers:
  - url: http://localhost:3000
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Token obtido em /auth/login
  
  schemas:
    Error401:
      type: object
      properties:
        error:
          type: string
          example: "Token não fornecido"
    
    Error403:
      type: object
      properties:
        error:
          type: string
          example: "Acesso negado. Roles permitidas: admin"

paths:
  /auth/register:
    post:
      summary: Registrar novo usuário
      tags: [Autenticação]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [nome, email, senha]
              properties:
                nome: { type: string }
                email: { type: string }
                senha: { type: string }
      responses:
        '201':
          description: Usuário registrado
        '400':
          description: Validação falhou
        '409':
          description: Email já cadastrado

  /usuarios:
    get:
      summary: Listar usuários
      tags: [Usuários]
      security:
        - bearerAuth: []
      parameters:
        - in: query
          name: role
          schema:
            type: string
            enum: [usuario, admin]
      responses:
        '200':
          description: Lista de usuários
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

components:
  responses:
    Unauthorized:
      description: Token não fornecido ou inválido
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error401'
    
    Forbidden:
      description: Sem permissão (role insuficiente)
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error403'
```

---

## ✅ Checklist Final de Implementação

- [ ] Soft delete implementado com reativação
- [ ] Fluxo autenticação: registro → apiKey → JWT
- [ ] Swagger com documentação de roles
- [ ] Email validado e case-insensitive
- [ ] CNH: 11 dígitos validados
- [ ] Email: regex validado
- [ ] Placa: regex Mercosul + antiga
- [ ] Data: validação e formato ISO
- [ ] Interceptor Bearer Token implementado
- [ ] Interceptor Refresh Token implementado
- [ ] Logger de auditoria implementado
- [ ] README atualizado
- [ ] SECURITY.md criado
- [ ] AUTH.md criado
- [ ] Swagger.yaml atualizado
- [ ] Testes de autenticação
- [ ] Testes de autorização
- [ ] Testes de validação de dados

---

**Documentação atualizada em:** 2024
**Status:** ✅ Pronto para implementação
