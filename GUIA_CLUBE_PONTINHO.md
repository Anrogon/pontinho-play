# 🎁 GUIA DO CLUBE PONTINHO
## Manual Técnico e de Configuração

Projeto: Pontinho Play

Versão: 1.0

---

# Sumário

1. Visão Geral
2. Arquitetura
3. Login Diário
4. Missão Diária
5. Missão Semanal
6. Carta da Sorte
7. Conquistas
8. Ranking Mensal
9. Banco de Dados
10. Fluxo Geral
11. Guia de Alterações
12. Migração para o Cachetão Pro
13. Histórico das Versões

---

# 1. VISÃO GERAL

O Clube Pontinho é o sistema oficial de recompensas do Pontinho Play.

Seu objetivo é incentivar o jogador a permanecer ativo, retornar diariamente ao jogo e disputar partidas continuamente através de diversos mecanismos de progressão.

Todo o sistema foi desenvolvido para funcionar automaticamente.

O jogador apenas joga normalmente e o Clube Pontinho registra seu progresso.

Atualmente o Clube Pontinho é composto pelos seguintes módulos:

• Login Diário

• Missão Diária

• Missão Semanal

• Carta da Sorte

• Conquistas

• Ranking Mensal

Cada módulo possui uma função específica dentro do jogo.

---

# Objetivos

Login Diário

Incentivar o jogador a entrar todos os dias.

Missão Diária

Estimular algumas partidas diariamente.

Missão Semanal

Incentivar frequência durante toda a semana.

Carta da Sorte

Criar um elemento surpresa.

Conquistas

Premiar desempenho de longo prazo.

Ranking Mensal

Criar competição entre todos os jogadores.

---

# Fluxo Geral

Login

↓

Login Diário

↓

Jogar Partidas

↓

Atualizar Estatísticas

↓

Conquistas

↓

Ranking Mensal

↓

Página de Recompensas

↓

Resgatar Missões

↓

Abrir Carta da Sorte

---

# 2. ARQUITETURA

Todo o Clube Pontinho foi dividido em pequenos serviços independentes.

Essa divisão evita grandes arquivos e facilita futuras alterações.

Estrutura:

server/

services/

rewardService.js

Login Diário

Missão Diária

Missão Semanal

──────────────

luckyCardService.js

Carta da Sorte

──────────────

achievementService.js

Conquistas

──────────────

monthlyRankingService.js

Ranking Mensal

──────────────

routes/

authRoutes.js

──────────────

client/

rewards.html

rewards.js

club-pontinho.html

assets/cards/

---

Cada serviço possui apenas uma responsabilidade.

Isso permite alterar um módulo sem interferir nos demais.

Exemplo:

Alterar os valores da Carta da Sorte.

Somente:

luckyCardService.js

precisa ser modificado.

Nenhum outro serviço será afetado.

---

# Integração

rewardService.js

↓

authRoutes.js

↓

rewards.js

↓

rewards.html

Enquanto isso:

server.js

apenas registra as estatísticas das partidas.

Depois das estatísticas atualizadas, o próprio server chama:

achievementService.js

e

monthlyRankingService.js

automaticamente.

Isso evita duplicação de código.

---

# 3. LOGIN DIÁRIO

Arquivo responsável

server/services/rewardService.js

Finalidade

Premiar o jogador por entrar diariamente no Pontinho Play.

O Login Diário funciona completamente de forma automática.

Ao realizar o login, o sistema verifica:

• último login

• sequência atual

• quantidade de fichas

Caso exista uma nova recompensa disponível, ela é creditada imediatamente.

Também é exibida uma mensagem na tela inicial.

Exemplo:

"Você recebeu 300 fichas pelo Login Diário."

---

Tabela atual

Dia 1

100 fichas

Dia 2

150 fichas

Dia 3

200 fichas

Dia 4

300 fichas

Dia 5

400 fichas

Dia 6

500 fichas

Dia 7

750 fichas

Depois do sétimo dia o ciclo reinicia.

---

Como alterar os valores

Arquivo

rewardService.js

Localize:

DAILY_LOGIN_REWARDS

Exemplo:

const DAILY_LOGIN_REWARDS = [

...

];

Basta alterar os valores desejados.

Não existe necessidade de alterar qualquer outro arquivo.

---

Como alterar a quantidade de dias

O tamanho do vetor DAILY_LOGIN_REWARDS define automaticamente a quantidade de dias do ciclo.

Exemplo:

7 posições

↓

7 dias

10 posições

↓

10 dias

Nenhuma outra alteração será necessária.

---

O que NÃO alterar

A lógica responsável por verificar:

último login

sequência

reinício do ciclo

deve permanecer exatamente como está.

Somente os valores das recompensas devem ser alterados.

---

Mensagem exibida ao jogador

Após um login válido, o sistema grava temporariamente a recompensa recebida.

Ao carregar a página inicial é exibida uma única mensagem.

Depois disso ela é removida automaticamente.

Assim o jogador nunca verá a mesma recompensa duas vezes.

---

Boas práticas

Não utilizar valores muito altos.

O Login Diário deve incentivar frequência.

Não substituir as demais formas de recompensa.

Valores pequenos e constantes produzem melhor resultado que grandes pagamentos esporádicos.

# 4. MISSÃO DIÁRIA

Arquivo responsável

server/services/rewardService.js

Objetivo

Incentivar o jogador a disputar algumas partidas todos os dias.

A Missão Diária é reiniciada automaticamente no início de um novo dia.

O progresso é individual para cada jogador.

Somente partidas concluídas são contabilizadas.

---

Funcionamento

Ao final de cada partida o servidor registra:

• quantidade de partidas do dia

• data de referência

Quando o objetivo é atingido, a missão fica disponível para resgate.

Nenhuma ficha é creditada automaticamente.

O jogador deve acessar:

Página de Recompensas

e clicar em

Resgatar

Após o resgate:

• as fichas são creditadas

• o botão desaparece

• a missão permanece marcada como concluída

---

Valores atuais

Objetivo

3 partidas

Recompensa

100 fichas

---

Como alterar

Arquivo

rewardService.js

Localize:

DAILY_MISSION_GOAL

Altere:

3

para qualquer outro valor.

Exemplo

5 partidas

↓

const DAILY_MISSION_GOAL = 5;

---

Recompensa

Localize:

DAILY_MISSION_REWARD

Exemplo

500

↓

1000

Nenhum outro arquivo precisa ser alterado.

---

Banco utilizado

user_reward_progress

Campos

daily_matches

Quantidade de partidas do dia.

daily_reference_date

Data da missão.

daily_reward_claimed

Indica se o prêmio já foi recebido.

---

Boas práticas

A Missão Diária deve ser simples.

O jogador precisa conseguir concluí-la em poucos minutos.

Ela existe para incentivar retorno diário, não para se tornar um objetivo difícil.

────────────────────────────────────────

# 5. MISSÃO SEMANAL

Arquivo responsável

server/services/rewardService.js

Objetivo

Incentivar frequência ao longo da semana.

Enquanto a Missão Diária incentiva jogar hoje, a Missão Semanal incentiva jogar durante vários dias.

---

Funcionamento

Cada partida concluída incrementa:

weekly_matches

Quando o objetivo é alcançado:

o botão

Resgatar

é habilitado.

Depois do resgate:

• fichas são creditadas

• a missão fica marcada como concluída

• novo prêmio somente na próxima semana.

---

Valores atuais

Objetivo

25 partidas

Recompensa

1000 fichas

---

Como alterar

Arquivo

rewardService.js

Objetivo

WEEKLY_MISSION_GOAL

Exemplo

25

↓

30

Recompensa

WEEKLY_MISSION_REWARD

Exemplo

1000

↓

2000

Nada mais precisa ser alterado.

---

Banco utilizado

user_reward_progress

Campos

weekly_matches

weekly_reference_date

weekly_reward_claimed

---

Reinício

A semana é controlada automaticamente.

Quando inicia uma nova semana:

• contador volta para zero

• novo período começa

• novo prêmio pode ser conquistado.

---

Boas práticas

A Missão Semanal deve representar um objetivo de médio prazo.

Não é recomendado utilizar metas extremamente altas.

────────────────────────────────────────

# 6. CARTA DA SORTE

Arquivo responsável

server/services/luckyCardService.js

Objetivo

Oferecer uma recompensa surpresa ao jogador.

O sistema utiliza um baralho real.

52 cartas

+

2 Coringas

=

54 cartas

Sempre são apresentadas

3 cartas

para escolha.

Após selecionar uma delas:

• ela é revelada

• as outras duas também são abertas

• somente a carta escolhida gera recompensa

---

Como o baralho é criado

O serviço monta dinamicamente:

todos os naipes

×

todos os valores

Depois adiciona

2 Coringas.

Cada sessão utiliza um baralho novo.

Nenhuma carta é repetida entre as três opções.

---

Premiação atual

2

200 fichas

3

300 fichas

4

400 fichas

5

500 fichas

6

600 fichas

7

700 fichas

8

800 fichas

9

900 fichas

10

1000 fichas

J

1100 fichas

Q

1200 fichas

K

1300 fichas

A

1500 fichas

Coringa

2000 fichas

---

Como alterar os valores

Arquivo

luckyCardService.js

Localize

LUCKY_CARD_REWARDS

Exemplo

A:1500

↓

A:2500

Nenhum outro arquivo precisa ser alterado.

---

Alterar os pesos

Localize

getRewardWeight()

Essa função controla a probabilidade de cada carta aparecer.

Quanto maior o peso

↓

maior a frequência.

Quanto menor o peso

↓

mais rara será a carta.

---

Tempo da sessão

Localize

LUCKY_CARD_SESSION_MINUTES

Controla quanto tempo o jogador possui para escolher uma carta.

Após esse tempo:

a sessão expira.

---

Banco utilizado

lucky_card_sessions

Armazena

• cartas sorteadas

• carta escolhida

• sessão pendente

• horário de expiração

---

Fluxo

Recebe Carta da Sorte

↓

Abre rewards.html

↓

Inicia sessão

↓

3 cartas são geradas

↓

Escolha do jogador

↓

Crédito das fichas

↓

Carta consumida

↓

Sessão encerrada

---

Boas práticas

Nunca altere a estrutura do baralho.

Sempre utilize:

52 cartas

+

2 Coringas

Apenas os valores das recompensas e os pesos devem ser modificados.

# 7. CONQUISTAS

Arquivo responsável

server/services/achievementService.js

Objetivo

As Conquistas recompensam o desempenho do jogador ao longo de toda a sua trajetória no Pontinho Play.

Diferentemente das Missões, elas não possuem prazo.

Cada conquista pode ser recebida apenas uma única vez.

As vitórias continuam sendo contabilizadas normalmente mesmo após todas as conquistas terem sido obtidas.

---

Funcionamento

Ao término de cada partida o servidor atualiza:

user_stats

Logo em seguida é executado:

processUserAchievements()

Essa função verifica:

• quantidade total de vitórias

• conquistas já recebidas

• novas conquistas liberadas

Caso exista uma nova conquista:

• as fichas são creditadas

ou

• uma Carta da Sorte é adicionada

Tudo acontece automaticamente.

O jogador não precisa clicar em nenhum botão.

---

Conquistas atuais

5 vitórias

↓

1 Carta da Sorte

──────────────────

10 vitórias

↓

1 Carta da Sorte

──────────────────

25 vitórias

↓

2.000 fichas

──────────────────

50 vitórias

↓

4.000 fichas

──────────────────

100 vitórias

↓

8.000 fichas

---

Como alterar

Arquivo

achievementService.js

Localize

ACHIEVEMENTS

Cada conquista possui:

key

wins

reward

Exemplo

wins:25

↓

wins:30

passará a liberar essa conquista somente com 30 vitórias.

---

Alterando valores

Exemplo

reward:

2000

↓

5000

Somente essa constante precisa ser alterada.

---

Criando novas conquistas

Basta adicionar um novo objeto.

Exemplo

250 vitórias

↓

20.000 fichas

Não existe limite de conquistas.

---

Banco utilizado

achievement_progress

Campos

user_id

achievement_key

claimed_at

Essa tabela impede que uma mesma conquista seja recebida duas vezes.

---

Fluxo

Fim da partida

↓

Atualiza user_stats

↓

processUserAchievements()

↓

Nova conquista?

↓

SIM

↓

Entrega prêmio

↓

Grava achievement_progress

↓

Fim

---

Boas práticas

Evite criar muitas conquistas pequenas.

Poucas metas relevantes geram melhor sensação de progresso.

────────────────────────────────────────

# 8. RANKING MENSAL

Arquivo responsável

server/services/monthlyRankingService.js

Objetivo

Criar uma competição mensal entre todos os jogadores.

O Ranking Mensal reinicia automaticamente no início de cada mês.

Os resultados anteriores permanecem gravados para histórico.

---

Funcionamento

Ao final de cada partida o servidor executa:

processMonthlyRankingResult()

Essa função atualiza:

• partidas

• vitórias

• derrotas

• aproveitamento

• pontuação

Todas as informações ficam armazenadas na tabela

monthly_ranking

---

Pontuação

A pontuação do Ranking é calculada automaticamente.

Atualmente:

Pontuação

=

Vitórias × Aproveitamento

Quanto maior o número de vitórias mantendo um bom aproveitamento,

maior será a pontuação.

---

Critérios de desempate

1

Maior pontuação.

↓

2

Maior número de vitórias.

↓

3

Menor número de derrotas.

↓

4

Quem alcançou primeiro.

---

Premiação

1°

50.000 fichas

──────────────────

2°

30.000 fichas

──────────────────

3°

20.000 fichas

──────────────────

4° ao 10°

10.000 fichas

──────────────────

11° ao 50°

5.000 fichas

──────────────────

51° ao 100°

1 Carta da Sorte

---

Como alterar

Arquivo

monthlyRankingService.js

Localize

MONTHLY_RANKING_PRIZES

Cada faixa pode ser alterada livremente.

Exemplo

de

50000

para

100000

Nenhuma outra alteração será necessária.

---

Alterar fórmula

Localize

calculateMonthlyRankingPoints()

Toda a lógica do cálculo está concentrada nessa função.

É possível criar qualquer fórmula desejada.

Exemplo

Vitórias × 100

Vitórias × Aproveitamento

Vitórias × 10 + Aproveitamento

etc.

---

Alterar desempate

Ainda dentro do mesmo arquivo localize o

ORDER BY

utilizado para montar o Ranking.

A ordem das colunas determina o desempate.

---

Fechamento Mensal

O fechamento acontece automaticamente.

Ao iniciar o Auth Server o sistema verifica:

Existe algum mês anterior ainda não processado?

Se existir:

↓

calcula a classificação final

↓

entrega os prêmios

↓

registra reward_transactions

↓

marca prize_paid = true

↓

nunca mais paga novamente.

---

Proteção contra pagamento duplicado

Todos os registros possuem:

prize_paid

Enquanto:

FALSE

↓

o jogador pode receber.

Depois do pagamento:

TRUE

↓

o sistema nunca mais paga aquele mês novamente.

Mesmo que o servidor reinicie dezenas de vezes.

---

Banco utilizado

monthly_ranking

Campos principais

matches_played

wins

losses

ranking_points

display_points

prize_chips

prize_lucky_cards

prize_paid

---

Fluxo

Fim da partida

↓

Atualiza Ranking

↓

Página Recompensas

↓

Mostra posição atual

↓

Mudança de mês

↓

Fechamento automático

↓

Pagamento

↓

Histórico

---

Boas práticas

Nunca altere diretamente os registros do Ranking pelo banco.

Sempre deixe que o serviço recalcule automaticamente.

Isso evita inconsistências na classificação.

# 9. BANCO DE DADOS

O Clube Pontinho utiliza cinco tabelas principais.

Cada uma possui uma responsabilidade específica.

Nunca utilize uma tabela para armazenar informações pertencentes a outra.

────────────────────────────────────────

user_reward_progress

Finalidade

Armazenar todo o progresso relacionado às recompensas diárias e semanais.

Campos principais

daily_matches

Quantidade de partidas da missão diária.

daily_reference_date

Data utilizada para identificar o dia atual.

daily_reward_claimed

Indica se a recompensa diária já foi recebida.

weekly_matches

Quantidade de partidas da missão semanal.

weekly_reference_date

Semana utilizada como referência.

weekly_reward_claimed

Indica se a recompensa semanal já foi recebida.

lucky_cards_available

Quantidade de Cartas da Sorte disponíveis para o jogador.

updated_at

Última atualização do registro.

────────────────────────────────────────

achievement_progress

Finalidade

Controlar quais conquistas já foram entregues.

Campos principais

user_id

achievement_key

claimed_at

Essa tabela impede que uma mesma conquista seja recebida duas vezes.

────────────────────────────────────────

monthly_ranking

Finalidade

Armazenar toda a classificação mensal.

Campos principais

ranking_month

game_code

matches_played

wins

losses

ranking_points

display_points

prize_chips

prize_lucky_cards

prize_paid

updated_at

Essa tabela nunca deve ser editada manualmente.

Sempre utilize os serviços do Ranking Mensal.

────────────────────────────────────────

reward_transactions

Finalidade

Histórico financeiro do Clube Pontinho.

Toda recompensa entregue deve possuir um registro nesta tabela.

Tipos atuais

daily_mission

weekly_mission

monthly_ranking_chips

monthly_ranking_lucky_card

Esse histórico facilita auditorias futuras.

────────────────────────────────────────

user_stats

Finalidade

Estatísticas gerais do jogador.

Campos principais

matches_played

wins

losses

total_profit

total_loss

updated_at

Essa tabela alimenta tanto as Conquistas quanto o Ranking Mensal.

────────────────────────────────────────

# 10. FLUXO COMPLETO DO CLUBE PONTINHO

LOGIN

↓

Login Diário

↓

Mensagem de recompensa

↓

Página Inicial

────────────────────────

PARTIDA

↓

Atualiza user_stats

↓

Atualiza Missões

↓

Atualiza Conquistas

↓

Atualiza Ranking Mensal

↓

Fim

────────────────────────

PÁGINA RECOMPENSAS

↓

Consultar progresso

↓

Resgatar Missão Diária

↓

Resgatar Missão Semanal

↓

Abrir Carta da Sorte

↓

Atualizar saldo

────────────────────────

INÍCIO DE UM NOVO MÊS

↓

Auth Server inicia

↓

Verifica Ranking pendente

↓

Calcula classificação

↓

Entrega prêmios

↓

Registra reward_transactions

↓

Marca prize_paid

↓

Fim

────────────────────────────────────────

# 11. GUIA RÁPIDO DE ALTERAÇÕES

Quero alterar...

Login Diário

↓

rewardService.js

↓

DAILY_LOGIN_REWARDS

──────────────────

Quantidade de partidas da Missão Diária

↓

rewardService.js

↓

DAILY_MISSION_GOAL

──────────────────

Valor da Missão Diária

↓

rewardService.js

↓

DAILY_MISSION_REWARD

──────────────────

Quantidade de partidas da Missão Semanal

↓

rewardService.js

↓

WEEKLY_MISSION_GOAL

──────────────────

Valor da Missão Semanal

↓

rewardService.js

↓

WEEKLY_MISSION_REWARD

──────────────────

Valores das Cartas da Sorte

↓

luckyCardService.js

↓

LUCKY_CARD_REWARDS

──────────────────

Probabilidade das Cartas

↓

luckyCardService.js

↓

getRewardWeight()

──────────────────

Tempo para escolher a carta

↓

luckyCardService.js

↓

LUCKY_CARD_SESSION_MINUTES

──────────────────

Conquistas

↓

achievementService.js

↓

ACHIEVEMENTS

──────────────────

Pontuação do Ranking

↓

monthlyRankingService.js

↓

calculateMonthlyRankingPoints()

──────────────────

Premiação do Ranking

↓

monthlyRankingService.js

↓

MONTHLY_RANKING_PRIZES

──────────────────

Critério de desempate

↓

monthlyRankingService.js

↓

ORDER BY

────────────────────────────────────────

# 12. MIGRAÇÃO PARA O CACHETÃO PRO

Os seguintes arquivos podem ser reaproveitados praticamente sem alterações:

✓ rewardService.js

✓ luckyCardService.js

✓ achievementService.js

✓ monthlyRankingService.js

✓ rewards.html

✓ rewards.js

✓ club-pontinho.html

──────────────────

Pequenos ajustes necessários

Trocar

gameCode

PONTINHO

↓

CACHETAO

──────────────────

Alterar os pontos onde as estatísticas das partidas são atualizadas.

──────────────────

Caso existam diferenças nas regras das partidas, elas não afetam o Clube Pontinho.

O sistema depende apenas de:

• partidas concluídas

• vitórias

• derrotas

• saldo do jogador

────────────────────────────────────────

# 13. HISTÓRICO DAS VERSÕES

Versão 1.0

✓ Login Diário

──────────────────

Versão 1.1

✓ Missão Diária

✓ Missão Semanal

──────────────────

Versão 1.2

✓ Carta da Sorte

──────────────────

Versão 1.3

✓ Conquistas

──────────────────

Versão 1.4

✓ Ranking Mensal

──────────────────

Versão 1.5

✓ Fechamento Automático do Ranking

────────────────────────────────────────

# 14. CHECKLIST FINAL

Login Diário

☑ Concluído

──────────────────

Missão Diária

☑ Concluída

──────────────────

Missão Semanal

☑ Concluída

──────────────────

Carta da Sorte

☑ Concluída

──────────────────

Conquistas

☑ Concluídas

──────────────────

Ranking Mensal

☑ Concluído

──────────────────

Fechamento Automático

☑ Concluído

──────────────────

Banco de Dados

☑ Concluído

──────────────────

Histórico Financeiro

☑ Concluído

──────────────────

Documentação

☑ Concluída

────────────────────────────────────────

# CONSIDERAÇÕES FINAIS

O Clube Pontinho foi desenvolvido para ser modular.

Cada sistema possui responsabilidades bem definidas e baixo acoplamento.

Essa arquitetura permite alterar ou expandir qualquer módulo sem necessidade de reescrever os demais.

Sempre que possível, novas funcionalidades devem seguir o mesmo padrão utilizado neste projeto:

• um serviço por responsabilidade;

• integração centralizada pelas rotas;

• persistência consistente no banco de dados;

• interface desacoplada da lógica de negócio.

Seguindo essas diretrizes, a manutenção torna-se mais simples e a reutilização do código em outros projetos — como o Cachetão Pro — é facilitada.

Fim do documento.