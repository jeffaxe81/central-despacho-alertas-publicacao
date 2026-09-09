# ADR-0002 — Contrato canônico de evento v1

- Status: aprovado e implementado como contrato isolado
- Data: 2026-09-09
- Decisão: CloudEvents 1.0 canônico com adaptadores nas bordas

## Contexto

O formato atual foi criado para alertas urbanos e contratos específicos, como ALRT → AXE. Torná-lo o formato do núcleo manteria o Motor dependente dos consumidores atuais. Manter dois formatos canônicos também duplicaria validação e regras.

## Decisão

O Motor terá um único envelope interno baseado em CloudEvents 1.0. Dados próprios da Axesistemas serão extensões do envelope e os dados de cada domínio permanecerão em `data`.

Campos obrigatórios desta versão:

- identificação: `specversion`, `id`, `source`, `type` e `time`;
- conteúdo: `datacontenttype`, `dataschema` e `data`;
- rastreabilidade: `correlationid` e `idempotencykey`;
- reprodução: `axesrunid`, `axesscenarioid`, `axesscenarioversion`, `axesseed` e `axessequence`;
- limite de segurança: `axessimulated` deve ser literalmente `true`.

Tipos seguem `com.axesistemas.<domínio>.<entidade>.<ação>.vN`. Schemas seguem `urn:axesistemas:schema:<domínio>:<nome>:X.Y.Z`.

`data` deve ser um objeto JSON. Seus valores podem conter strings, números finitos, booleanos, `null`, arrays e outros objetos JSON. Valores exclusivos do JavaScript, como `bigint`, `undefined`, funções, `NaN` e infinito, são rejeitados antes da persistência ou publicação.

As versões de cenário e schema usam o núcleo SemVer `X.Y.Z`, inclusive versões iniciais como `0.1.0`, sem zeros à esquerda. Sufixos de pré-release e build metadata ficam fora desta primeira versão.

O envelope v1 é fechado: campos superiores não declarados são rejeitados. Uma nova extensão CloudEvents deve ser adicionada explicitamente ao schema e versionada, garantindo que todo evento validado permaneça serializável em JSON.

## Consequências

- O núcleo ganha um contrato único, validável e independente do Despacho.
- Novos domínios podem variar o conteúdo de `data` sem alterar o executor.
- Mudanças incompatíveis exigem novo tipo ou nova versão de schema.
- O contrato ALRT → AXE permanece inalterado e será produzido por adaptador.
- Esta microentrega não publica o envelope no barramento, não altera banco e não ativa destinos reais.

## Validação manual

1. Execute `./node_modules/.bin/vitest run shared/events/canonicalEvent.test.ts`.
2. Execute `./node_modules/.bin/tsc --noEmit`.
3. Confirme que um evento sem `axesrunid` é rejeitado.
4. Confirme que `axessimulated: false` é rejeitado.

Se falhar, observe primeiro qual campo e qual regra aparecem no erro do Zod. Falha de importação normalmente indica caminho incorreto; falha de tipagem indica divergência entre o schema e seus consumidores.
