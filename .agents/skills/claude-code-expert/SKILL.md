---
name: Codex-expert
description: "Especialista profundo em Codex - CLI da Anthropic. Maximiza produtividade com atalhos, hooks, MCPs, configuracoes avancadas, workflows, AGENTS.md, memoria, sub-agentes, permissoes e integracao com ecossistemas."
risk: none
source: community
date_added: '2026-03-06'
author: renat
tags:
- Codex
- productivity
- cli
- configuration
tools:
- Codex
- antigravity
- cursor
- gemini-cli
- codex-cli
---

<!-- security-allowlist: curl-pipe-bash -->

# Codex EXPERT - Potencia Maxima

## Overview

Especialista profundo em Codex - CLI da Anthropic. Maximiza produtividade com atalhos, hooks, MCPs, configuracoes avancadas, workflows, AGENTS.md, memoria, sub-agentes, permissoes e integracao com ecossistemas. Ativar para: configurar Codex, criar hooks, otimizar AGENTS.md, usar MCPs, criar sub-agentes, resolver erros do CLI, workflows avancados, duvidas sobre qualquer feature.

## When to Use This Skill

- When you need specialized assistance with this domain

## Do Not Use This Skill When

- The task is unrelated to Codex expert
- A simpler, more specific tool can handle the request
- The user needs general-purpose assistance without domain expertise

## How It Works

Voce e o especialista definitivo em Codex. Seu objetivo e transformar
cada sessao em uma experiencia 10x mais poderosa, rapida e inteligente.

---

## 1. Fundamentos Do Codex

Codex e a CLI oficial da Anthropic para usar Codex como agente de codigo
diretamente no terminal. Diferente do Codex.ai web, o Codex:
- Acessa seu filesystem diretamente
- Executa comandos bash, git, npm, etc.
- Persiste contexto via AGENTS.md e memory files
- Suporta MCP servers (extensoes de ferramentas)
- Suporta hooks (automacoes pre/pos-acao)
- Pode criar e orquestrar sub-agentes via Task tool

## Instalacao E Setup

```bash
npm install -g @anthropic-ai/Codex
Codex                    # iniciar sessao interativa
Codex "sua tarefa aqui"  # modo nao-interativo
Codex --help             # ver todos os flags
```

## Flags Essenciais

```bash
Codex -p "prompt"              # print mode, ideal para scripts
Codex --model Codex-opus-4    # especificar modelo
Codex --max-tokens 8192        # limite de tokens
Codex --no-stream              # sem streaming
Codex --output-format json     # saida em JSON
Codex --allowed-tools "Bash,Read,Write"  # limitar ferramentas
Codex --dangerously-skip-permissions     # pular confirmacoes (cuidado!)
Codex --max-turns 50                     # maximo de turnos autonomos
```

---

## 2. AGENTS.md - O Cerebro Do Projeto

O arquivo AGENTS.md na raiz do projeto e carregado automaticamente em TODA sessao.
E a forma mais poderosa de dar contexto e instrucoes persistentes ao Codex.

## Hierarquia De AGENTS.md

1. ~/.Codex/AGENTS.md          global, carregado em todo projeto
2. /projeto/AGENTS.md           nivel de projeto
3. /projeto/subpasta/AGENTS.md  nivel de subpasta, carregado ao navegar

## Estrutura Recomendada

```markdown

## Contexto

O que e este projeto, tecnologias, arquitetura

## Comandos Essenciais

Scripts mais usados: npm run dev, pytest, etc.

## Convencoes De Codigo

Estilo, naming, patterns obrigatorios

## Arquitetura

Estrutura de pastas, responsabilidades de cada modulo

## Regras De Negocio Criticas

O que NUNCA fazer, invariantes do sistema

## Agentes E Skills Disponiveis

Lista de skills, quando usar cada uma

## Protocolo Pre-Tarefa

Sempre rodar orchestrator antes de responder
```

## Dicas De AGENTS.md De Elite

- Use secao Protocolo Pre-Tarefa para garantir que o Codex sempre use orchestrator
- Adicione secao Erros Conhecidos com solucoes para problemas recorrentes
- Use secao Memoria como indice para arquivos de memoria detalhados
- Adicione exemplos concretos de output esperado
- Referencie paths absolutos para scripts criticos

---

## Localizacao Dos Arquivos De Memoria

```
~/.Codex/projects/<hash-do-path>/memory/
├── MEMORY.md          # indice e contexto rapido (max 200 linhas)
├── ai-personas.md     # detalhes de personas e skills ativas
├── project-X.md       # contexto de projetos especificos
└── decisions.md       # decisoes tecnicas importantes
```

## Memoria Ativa (Em AGENTS.md)

Carregar antes de qualquer tarefa: memory/MEMORY.md
Para projetos ativos: memory/ai-personas.md

## Instrucao De Salvamento Automatico:

Ao final de sessoes longas, execute:
python context-agent/scripts/context_manager.py save
```

## Context Guardian - Prevenir Perda De Contexto

O context-guardian skill monitora compactacao automatica e salva snapshots.
Ativar no inicio de sessoes longas ou criticas.

---

## 4. Hooks - Automacao Poderosa

Hooks executam comandos automaticamente em eventos do Codex.

## Localizacao Dos Hooks

- Global: ~/.Codex/settings.json
- Por projeto: .Codex/settings.json (na raiz do projeto)

## Tipos De Hooks Disponiveis

| Hook | Quando Dispara |
|------|----------------|
| PreToolUse | Antes de qualquer ferramenta ser usada |
| PostToolUse | Apos qualquer ferramenta ser usada |
| Notification | Ao receber notificacao do sistema |
| Stop | Quando o agente para de responder |
| SubagentStop | Quando sub-agente para |

## Exemplo: Hook De Beep Ao Terminar

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -c \\"[Console]::Beep(800,300)\\""
          }
        ]
      }
    ]
  }
}
```

## Exemplo: Hook De Log De Acoes Bash

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo dated-action >> ~/.Codex/action_log.txt"
          }
        ]
      }
    ]
  }
}
```

## Exemplo: Hook Scanner De Seguranca Pre-Commit

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python C:/Users/renat/skills/cred-omega/scripts/secret_scanner.py --staged 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

## Ver E Validar Hooks Ativos

```bash
cat ~/.Codex/settings.json
python -m json.tool ~/.Codex/settings.json   # valida o JSON
```

---

## 5. Mcp Servers - Extensoes De Ferramentas

MCP (Model Context Protocol) permite adicionar ferramentas externas ao Codex.
Cada MCP server expoe novas ferramentas que o Codex pode usar nas sessoes.

## Comandos Mcp

```bash
Codex mcp add filesystem       # acesso expandido a arquivos
Codex mcp add github           # integracao com GitHub (PRs, issues)
Codex mcp add postgres         # queries SQL em banco Postgres
Codex mcp add sqlite           # queries SQL em SQLite
Codex mcp list                 # listar MCPs instalados
Codex mcp get nome-servidor    # detalhes de um MCP especifico
Codex mcp remove nome          # remover um MCP
```

## Mcps Mais Uteis

| MCP | Funcao Principal |
|-----|------------------|
| filesystem | Acesso expandido a arquivos alem do projeto |
| github | PRs, issues, commits, reviews via Codex |
| postgres / sqlite | Consultas SQL diretas sem sair do Codex |
| puppeteer / playwright | Automacao de browser e web scraping |
| slack | Notificacoes e mensagens em canais |
| fetch | HTTP requests diretos para APIs |

## Criar Mcp Server Customizado Em Node.Js

```javascript
// mcp-server.js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "meu-mcp", version: "1.0.0" });
server.setRequestHandler("tools/call", async (req) => {
  if (req.params.name === "minha_ferramenta") {
    return { content: [{ type: "text", text: "resultado" }] };
  }
});
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Adicionar Mcp Customizado

```bash
Codex mcp add meu-mcp node /caminho/para/mcp-server.js
```

---

## 6. Sub-Agentes - Paralelismo Total

O Codex pode criar sub-agentes via Task tool para trabalho paralelo.
Cada sub-agente roda de forma independente com seu proprio contexto.

## Padroes De Orquestracao

**Spawn paralelo (multiplas tarefas simultaneas):**
Use Task tool com run_in_background: true para cada tarefa independente.
Exemplo com 3 agentes em paralelo:
- Agente 1: analisa codigo existente
- Agente 2: pesquisa documentacao
- Agente 3: escreve casos de teste
Todos rodam simultaneamente. Resultado chega via TaskOutput.

**Tipos de sub-agente:**
- general-purpose: pesquisa, analise e codigo geral
- Bash: apenas execucao de comandos de terminal
- Explore: exploracao rapida de codebase
- Plan: arquitetura e planejamento de solucoes

**Isolation com git worktree:**
Use isolation: worktree para que o sub-agente trabalhe em branch isolada.
Ideal para: experimentos, refatoracoes arriscadas, POCs sem risco ao main.

## Boas Praticas Com Sub-Agentes

1. Sempre passar CONTEXTO COMPLETO no prompt (o sub-agente nao ve o historico)
2. Especificar exatamente onde salvar outputs (use paths absolutos)
3. Usar run_in_background: true para tarefas longas
4. Verificar resultado com TaskOutput apos conclusao
5. Passar o AGENTS.md do projeto no contexto inicial do sub-agente

---

## Configurar Permissoes Por Projeto (.Codex/Settings.Json)

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Read(*)",
      "Write(src/**)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)",
      "Bash(curl * | bash)"
    ]
  }
}
```

## Flags De Permissao Em Linha De Comando

```bash
Codex --dangerously-skip-permissions        # pula TODAS as confirmacoes
Codex --allowed-tools "Read,Write,Bash"     # apenas estas ferramentas
Codex --disallowed-tools "WebFetch"         # bloquear especificas
```

## Quando Usar --Dangerously-Skip-Permissions

Apenas em: CI/CD controlados, scripts automatizados, sandboxes isoladas.
NUNCA usar em: producao, repos com segredos, ambientes compartilhados.

---

## Workflow De Feature Completa (4 Fases)

```bash

## Fase 1: Briefing E Planejamento

Codex -p "analise a feature X e crie um plano detalhado de implementacao"

## Fase 2: Implementacao

Codex "implemente a feature X seguindo o plano gerado"

## Fase 3: Testes

Codex "escreva testes completos para a feature X implementada"

## Fase 4: Code Review

Codex "faca code review da feature X, identifique problemas e refine"
```

## Modo Autonomo Para Ciclos Longos

```bash
Codex --max-turns 100 "complete o ciclo completo de desenvolvimento da feature X"
```

## Script De Inicio De Sessao Produtiva

```bash
#\!/bin/bash
echo "Carregando contexto do projeto..."
Codex -p "leia memory/MEMORY.md e me da um briefing completo do estado atual"
```

## Pipeline Ci/Cd Com Codex

```yaml

## .Github/Workflows/Codex-Review.Yml

- name: Codex Review
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    Codex -p "revise o diff deste PR, identifique bugs e problemas de seguranca" \n      --output-format json \n      --no-stream \n      --max-turns 5
```

---

## Tabela De Problemas Comuns

| Problema | Causa Provavel | Solucao |
|----------|----------------|----------|
| API key not found | ANTHROPIC_API_KEY nao configurada | export ANTHROPIC_API_KEY=sk-ant-... |
| Timeout em tarefas longas | max-turns insuficiente | Adicionar --max-turns 100 |
| Context window cheio | Muitos arquivos no contexto | Usar sub-agentes com contexto focado |
| Sub-agente nao acha arquivo | Path relativo errado | Usar path absoluto sempre |
| Hook nao executa | JSON invalido em settings.json | python -m json.tool ~/.Codex/settings.json |
| MCP nao conecta | Servidor MCP nao iniciado | Codex mcp list e checar status |
| Compactacao inesperada | Sessao muito longa | Usar context-guardian skill |
| Erro de permissao em Bash | Tool nao permitida | Adicionar ao allow em settings.json |

## Ver Logs E Historico De Sessoes

```bash
ls ~/.Codex/projects/
ls ~/.Codex/projects/<hash>/
cat ~/.Codex/projects/<hash>/*.jsonl | python -m json.tool
```

---

## ~/.Codex/Settings.Json Completo E Recomendado

```json
{
  "theme": "dark",
  "verbose": false,
  "cleanupPeriodDays": 30,
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -c \\"[Console]::Beep(800,200); Start-Sleep -Milliseconds 100; [Console]::Beep(1000,200)\\""
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(python *)",
      "Bash(powershell *)",
      "Read(*)",
      "Write(*)"
    ]
  }
}
```

## Variaveis De Ambiente Essenciais

```bash
export ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1   # modo privado
```

---

## Como Codex Se Integra Com As Skills Auri

1. AGENTS.md global lista todas as skills disponiveis e quando usar cada uma
2. agent-orchestrator e executado em toda solicitacao para identificar skills relevantes
3. task-intelligence enriquece tarefas moderadas/complexas com briefing pre-tarefa
4. context-agent salva e restaura estado entre sessoes
5. context-guardian previne perda de contexto em sessoes longas

## Comandos Rapidos Do Ecossistema

```bash
python agent-orchestrator/scripts/scan_registry.py           # atualizar registry
python agent-orchestrator/scripts/match_skills.py "tarefa"  # identificar skills
python task-intelligence/scripts/pre_task_check.py "tarefa" # briefing
python context-agent/scripts/context_manager.py save        # salvar contexto
python context-agent/scripts/context_manager.py load        # carregar contexto
```

## Quando Esta Skill E Ativada

Esta skill e ativada automaticamente quando o usuario quer:
- Configurar ou otimizar o Codex CLI
- Criar, debugar ou otimizar hooks
- Adicionar ou configurar MCP servers
- Criar sub-agentes e orquestracao paralela
- Entender qualquer feature do Codex
- Resolver erros ou comportamentos inesperados do CLI
- Otimizar AGENTS.md e arquivos de memoria
- Configurar permissoes e seguranca

---

## 12. Slash Commands No Codex

| Comando | Acao |
|---------|------|
| /status | Ver estado atual da sessao e contexto |
| /clear | Limpar historico da conversa atual |
| /compact | Compactar contexto (Codex resume o historico) |
| /memory | Ver e editar arquivos de memoria |
| /hooks | Ver hooks configurados e ativos |
| /mcp | Ver MCPs conectados e seus status |
| /cost | Ver custo em tokens e USD da sessao |
| /model | Trocar modelo em uso (opus, sonnet, haiku) |
| /help | Ver todos os comandos e atalhos disponiveis |

---

## 13. Referencias Oficiais

- Documentacao principal: https://docs.anthropic.com/Codex
- Referencia de hooks: https://docs.anthropic.com/Codex/hooks
- Referencia de settings: https://docs.anthropic.com/Codex/settings
- MCP SDK e exemplos: https://github.com/modelcontextprotocol/sdk
- Repositorio oficial: https://github.com/anthropics/Codex
- Release notes: https://docs.anthropic.com/Codex/changelog

## Best Practices

- Provide clear, specific context about your project and requirements
- Review all suggestions before applying them to production code
- Combine with other complementary skills for comprehensive analysis

## Common Pitfalls

- Using this skill for tasks outside its domain expertise
- Applying recommendations without understanding your specific context
- Not providing enough project context for accurate analysis

## Related Skills

- `007` - Complementary skill for enhanced analysis
- `matematico-tao` - Complementary skill for enhanced analysis
