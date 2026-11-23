# ZenField · Portal do técnico

Aplicação do ecossistema **ZenTracking** para consultar serviços, registrar a execução em campo, enviar evidências e acompanhar equipamentos e valores do técnico.

Esta revisão parte da branch `feat/ecossistema-homologacao`, versão 1.1, e requer a API ZenControl 6.4 ou superior. O projeto possui dependências, compilação e hospedagem próprias.

## Como funciona

- Técnicos entram pelo ZenTracking e seguem diretamente ao ZenField.
- Administradores e operadores selecionam o ambiente de um técnico. As ações permanecem identificadas pelo usuário real da central.
- O atendimento reúne os equipamentos previstos em um único registro, inclusive quando existem unidades adicionais.
- Etiquetas de rastreador e TAG são enviadas em múltiplas fotos. A API identifica códigos de barras e QR Code e confere os equipamentos na carga correta.
- Etiquetas ilegíveis ou incompatíveis geram aviso. Fotos gerais são opcionais, sem quantidade mínima.
- Checklist assinado, data executada e observações do técnico completam o envio. Rascunhos podem ser salvos antes disso.
- A central confere as fotos no ZenControl. Nas instalações, a conclusão depende também do recibo do Estoque Pro.

Há consulta da carga, solicitações de estoque, tarifas, pedidos de reajuste e demonstrativos financeiros. Despesas extras exigem vínculo com a OS principal, valor, descrição e foto do comprovante, com aprovação da central. A taxa de deslocamento é definida pela operação e aparece para consulta.

A interface oferece modos claro, escuro e automático e adaptação ao celular.

## Desenvolvimento

Requer Node.js 24:

```bash
npm ci --include=dev
npm run check
npm run dev
```

Configure `VITE_API_URL` com a URL do backend. Em desenvolvimento local, por exemplo, `http://127.0.0.1:3000`. O Vite abre na porta 5174.

Para testar as três aplicações juntas, siga [Homologação do ecossistema](https://github.com/rastreamento-git/zencontrol/blob/feat/ecossistema-homologacao/HOMOLOGACAO.md).

## Publicação

Na Vercel, use a raiz do repositório, instalação `npm ci --include=dev`, compilação `npm run build`, saída `dist` e Node.js 24. Configure `VITE_API_URL` com a URL HTTPS da API antes de compilar. O arquivo `vercel.json` contém o redirecionamento das rotas para a aplicação.

No backend ZenControl, configure `TECHNICIAN_PORTAL_URL` com a origem real do ZenField e preserve as demais origens autorizadas. Alterações em `VITE_API_URL` exigem nova compilação. Variáveis `VITE_*` são públicas e não devem conter senhas ou segredos.

A hospedagem alternativa no Render continua descrita em `render.yaml`. A publicação de produção depende do ambiente e do aceite operacional.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `src/FieldEntry.jsx` | Seleção do ambiente pela central |
| `src/Portal.jsx` | Serviços, fotos, checklist e execução |
| `src/Ecosystem.jsx` | Resumo, estoque, valores e financeiro |
| `src/ui` | Componentes, sessão, tema e utilitários próprios |

As regras de autorização, leitura de etiquetas e remuneração são verificadas pelo backend. Reagendamentos aguardam confirmação da nova data. Somente a central autoriza dispensa de rastreador.

Desenvolvido por Victor Rodrigues.
