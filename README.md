> **ZenField 1.1 — branch de homologação.** Use o [guia local do ecossistema](https://github.com/rastreamento-git/zencontrol/blob/feat/ecossistema-homologacao/HOMOLOGACAO.md). Requer API ZenControl 6.4. O fluxo de primeiro acesso, notificações e financeiro exige a migração 005 do backend. Não executar deploy/migrações em produção nesta etapa.

# ZenField

Portal dos técnicos — versão 1.0.0. Projeto independente do repositório ZenControl, com dependências, login, sessão e publicação próprios. Não usa workspaces nem importa arquivos de outro projeto.

O técnico consulta a OS, envia fotos do serviço e da vistoria, fotografa as etiquetas dos rastreadores/TAGs, anexa o checklist assinado e acompanha a confirmação da central. A leitura dos códigos ocorre no backend do ZenControl, que consulta o Estoque Pro. A aprovação e o fechamento financeiro continuam no ZenControl.

## Antes de publicar

O backend precisa conter a atualização 6.3 do portal: migração 004, leitura de etiquetas, checklist PDF, autenticação por perfil e `TECHNICIAN_PORTAL_URL`. O backend 6.2 ainda não oferece todo esse fluxo. O pacote de entrega inclui um patch separado para atualizar o ZenControl; ele não faz parte do repositório ZenField.

## Repositório próprio

Crie um repositório vazio chamado `zenfield` na sua conta do GitHub. Envie **o conteúdo desta pasta**, com `package.json` na raiz. Não envie `node_modules`, `dist` ou `.env`. O arquivo `.env.example` contém somente configurações públicas de exemplo.

Para uma cópia local do repositório vazio, copie os arquivos e execute:

```bash
git add .
git commit -m "feat: ZenField portal dos técnicos"
git push -u origin main
```

## Hospedagem no Render

Crie **New → Static Site** e selecione o repositório `zenfield`.

| Campo             | Valor                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Name              | `zenfield` ou outro nome disponível                                |
| Branch            | `main`                                                             |
| Root Directory    | Vazio                                                              |
| Build Command     | `npm ci --include=dev && npm run build`                            |
| Publish Directory | `dist`                                                             |
| `NODE_VERSION`    | `24`                                                               |
| `VITE_API_URL`    | `https://zencontrol.onrender.com` (use o endereço real do backend) |

Em **Redirects/Rewrites**, adicione `/*` → `/index.html`, ação **Rewrite**. Para uma nova instalação via Blueprint, `render.yaml` contém apenas o site ZenField.

O build exige `VITE_API_URL` e recusa URL sem HTTPS, exceto localhost para desenvolvimento. Essa variável é pública; chaves do Supabase, conexão Aiven e segredos de integração ficam exclusivamente no backend.

Depois que o Render gerar o endereço próprio do ZenField, configure no **Web Service do ZenControl**:

```dotenv
TECHNICIAN_PORTAL_URL=https://ENDERECO-REAL-DO-ZENFIELD.onrender.com
```

Salve e implante o backend. Essa configuração autoriza a origem do ZenField na API e atualiza os links dos PDFs. Preserve os demais valores de `CORS_ORIGINS`. Se mudar `VITE_API_URL`, reconstrua e publique o Static Site.

## Configuração operacional na central

1. Cadastre o técnico e vincule-o ao cadastro do Estoque Pro.
2. Crie uma conta individual com perfil Técnico e associe o cadastro.
3. Distribua os equipamentos na carga correta e mantenha categoria `RASTREADOR` ou `TAG`.
4. Confira o bucket Supabase privado, permitindo JPEG e PDF quando houver restrição de MIME.
5. Habilite a integração com o Estoque Pro e `ZEN_RUN_WORKER=true` na API.
6. Homologue uma OS completa antes de distribuir o acesso ao ZenField.

O envio recebe confirmação pendente. A central confere fotos, checklist e assinatura; a OS só entra no fechamento após a conclusão. Nas instalações, também é necessário o recibo do Estoque Pro. O ZenField não executa pagamento automático.

## Desenvolvimento e validação

Node.js 24:

```bash
npm ci --include=dev
npm run check
npm run dev
```

O portal abre na porta 5174. Para usar a API local, configure `VITE_API_URL=http://127.0.0.1:3000` no `.env` e `TECHNICIAN_PORTAL_URL=http://127.0.0.1:5174` no backend.

```bash
VITE_API_URL=https://zencontrol.onrender.com npm run build
```

No PowerShell, defina `$env:VITE_API_URL='https://zencontrol.onrender.com'` antes de executar `npm run build`.

O workflow incluído verifica as fontes e o build do ZenField sem baixar o ZenControl. Os testes do backend ficam no repositório da central. PDFs assinados são conferidos pelo operador; etiquetas precisam mostrar um código de barras ou QR Code legível.
