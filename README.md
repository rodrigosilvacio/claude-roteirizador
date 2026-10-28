# Rota. Roteirizador de trajetos

Planeje uma rota com até 25 paradas, veja no mapa e deixe o sistema encontrar a ordem que economiza mais tempo ou quilômetros. Depois, leve a rota para o Google Maps, Waze ou WhatsApp.

## O que ele faz

| Recurso | Detalhe |
| :-- | :-- |
| Busca de endereços | Autocomplete restrito ao Brasil, com tipo do resultado (rua, cidade, estado). Estados inteiros vão para o fim da lista e geram aviso, porque o ponto deles é o centro geográfico (era isso que fazia "São Paulo, Brasil" cair perto de São Carlos). |
| Três formas de terminar | **Destino fixo**, **volta à partida** (circuito) ou **melhor final** (o sistema escolhe a última parada). |
| Otimização | Por **menor tempo** ou **menor distância**. Até 12 paradas o resultado é o ótimo exato (programação dinâmica Held-Karp); acima disso, vizinho mais próximo com melhorias 2-opt e or-opt. Nunca entrega uma ordem pior que a digitada. |
| Comparação | Mostra quanto a ordem otimizada economiza frente à digitada, e diz claramente quando a ordem digitada já era a melhor. Um clique reordena os campos na sequência otimizada. |
| Mapa interativo | Clique no mapa para adicionar parada, partida ou destino. Arraste os pinos para ajustar o ponto exato. Passe o mouse num trecho para destacá-lo. |
| Trajeto do motorista | Instruções curva a curva em português, por trecho, com código da rodovia e sentido. Clique numa instrução para vê-la no mapa. |
| Custo da viagem | Combustível (gasolina, etanol, diesel ou GNV, com consumo e preço editáveis) mais pedágio, com custo por km e divisão entre pessoas. Entra no resumo, na comparação de ordens e no texto do WhatsApp. |
| Pedágio | Detecta os km em rodovia pedagiada em cada trecho e estima o valor pela tarifa média por km, com multiplicador por categoria de veículo (moto a caminhão 4 eixos). Se você souber o valor real, ele substitui a estimativa. Opção **evitar pedágios** recalcula a rota fora delas. Avisa quando há balsa. |
| Levar para a estrada | Google Maps (rotas com mais de 9 paradas viram links encadeados), Waze por parada, WhatsApp, link compartilhável e impressão. |
| Memória | O planejamento fica salvo no navegador. O link compartilhado carrega a rota completa em outro aparelho. |

## Stack

- React 18, TypeScript, Vite, Tailwind CSS
- Leaflet com mapa CARTO/OpenStreetMap
- [OSRM](https://project-osrm.org/) para rotas e matriz de tempos/distâncias
- [Photon](https://photon.komoot.io/) para busca e geocodificação reversa
- Sem backend, sem chave de API, sem custo

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do otimizador, instruções e links
npm run build    # gera dist/ para publicar
```

Para usar servidores próprios, copie `.env.example` para `.env.local` e ajuste `VITE_OSRM_URL` e `VITE_PHOTON_URL`.

## Publicação

O workflow `.github/workflows/deploy.yml` testa, compila e publica no GitHub Pages a cada push na `main`. Ative em *Settings → Pages → Source: GitHub Actions*.

## Limitações conhecidas

- **Sem trânsito em tempo real.** Os tempos vêm do OSRM, com velocidades típicas das vias.
- **Servidores públicos.** O OSRM de demonstração e o Photon têm uso justo e podem ficar instáveis. Para uso diário de uma equipe, hospede os dois (ambos têm imagem Docker) ou troque por um provedor pago.
- **Pedágio é estimativa.** Os mapas abertos marcam quais vias são pedagiadas, mas não o preço de cada praça. O valor sai de uma tarifa média por km (R$ 0,16 para carro, editável). Para valores exatos, informe o total real.
- **Preços de combustível são referências** e ficam desatualizados: edite com o valor do seu posto (fica salvo no navegador).

## Privacidade (LGPD)

Os endereços ficam só no navegador (localStorage) e são enviados apenas aos serviços de busca e rota para o cálculo. Não há login, banco de dados ou rastreamento. O link compartilhável carrega os endereços no próprio link: compartilhe só com quem deve vê-los.

## Próximos passos sugeridos

1. Praças de pedágio com tarifa oficial (ANTT, ARTESP) para trocar a estimativa por valor exato.
2. Horário de saída, tempo em cada parada e previsão de chegada.
3. Importar lista de endereços (colar ou CSV).
4. Rotas salvas com login (Supabase) e histórico.
5. Janelas de horário por parada e múltiplos veículos.
