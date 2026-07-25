# 🚀 Agiliza: Gestão de Assinaturas e Cobrança Recorrente com Lembrete Inteligente e IA Preditiva

Aqui está o detalhamento estratégico estruturado como um guia completo de produto e negócios para validação e desenvolvimento rápido.

---

## 1. O Conceito (Elevator Pitch)
Um motor de cobrança recorrente "invisível" e focado em **conversão via WhatsApp**, potencializado por **Inteligência Artificial Preditiva desde o dia zero (Cold Start)**. Em vez de forçar o cliente a entrar em um portal de pagamentos, baixar um app ou decorar um código de barras, o sistema envia lembretes proativos com **Links Mágicos** (PIX Copia e Cola de 1 clique ou Cartão tokenizado) no **momento ideal, pelo canal ideal e com a mensagem ideal** para cada perfil de pagador. O foco não é apenas cobrar, mas **eliminar a inadimplência por esquecimento e prever risco de churn** sem gerar atrito ou constrangimento humano, aprendendo continuamente com cada interação.

---

## 2. A Dor Profunda (Por que as soluções atuais falham?)
* **Boletos Bancários Tradicionais:** O cliente esquece de pagar. O B2B precisa cobrar manualmente, gerar remessa, registrar retorno e conciliar. Alto custo operacional e constrangimento na hora da cobrança. **Zero inteligência: todos recebem o mesmo boleto no mesmo dia.**
* **Portais do Cliente (Aluno/Morador):** Ninguém acessa. Exigem criação de senha, recuperação de senha e navegação complexa. A taxa de adoção é baixíssima. **Não geram dados comportamentais utilizáveis.**
* **Cartão de Crédito Recorrente (Van):** Taxas altas das adquirentes, risco de chargeback, e configuração técnica complexa para pequenos negócios. **Falta de flexibilidade para quem não tem cartão ou limite.**
* **Cobrança Humana (WhatsApp/Telefone do Financeiro):** Toma horas da equipe, gera atrito, inconsistência na mensagem e queima a relação com o cliente. **Decisões baseadas em "feeling", não em dados.**
* **Sistemas de Cobrança Genéricos (ERP/CRM):** Disparam réguas estáticas (D-3, D0, D+5) iguais para todos. **Não sabem *quem* vai pagar, *quando* prefere pagar, nem *como* prefere ser abordado.**

---

## 3. Como Funciona na Prática (Jornada do Usuário Aprimorada com IA)

### 🟢 Para o Cliente Final (B2C) — Experiência Hiperpersonalizada
1.  **Onboarding Inteligente (Cold Start):** No primeiro cadastro, o sistema faz 3 perguntas rápidas via WhatsApp: *"Qual melhor horário para receber lembrete?", "Prefere PIX ou Cartão?", "Quer lembrete antecipado (D-5) ou no dia?"*. Isso substitui meses de coleta passiva de dados.
2.  **Recebimento Proativo no "Momento de Ouro":** 3 dias antes do vencimento (ou no horário preferido aprendido), recebe: *"Olá, João! Sua mensalidade de Outubro está chegando. Como você pediu, deixei o PIX de 1 clique pronto aqui. É só apertar."*
3.  **Pagamento sem Atrito:** Clica no botão, app do banco abre com PIX preenchido. Autentica com biometria e paga em 5 segundos.
4.  **Confirmação Instantânea + Feedback Loop:** Baixa automática + recibo em PDF. O sistema registra: *Horário de abertura, horário de pagamento, canal usado, device*. Esse dado alimenta o modelo para o próximo mês.
5.  **Fluxo de Inadimplência Adaptativo (Não-Estatic):** Se não pagar, a IA decide a próxima ação baseada no **Score de Propensão a Pagamento** e **Perfil Comportamental**:
    *   *Perfil "Esquecido/Organizado":* Lembrete amigável no dia do vencimento (D0) + D+2.
    *   *Perfil "Aperto Financeiro":* Oferta de parcelamento no boleto/PIX parcelado ou mudança de data de vencimento (D+1).
    *   *Perfil "Desengajado/Risco Churn":* Mensagem de retenção ("Sentimos sua falta, quer ajustar o plano?") + alerta no dashboard B2B para ação humana.

### 🔵 Para o Estabelecimento (B2B) — Gestão Baseada em Dados
1.  **Configuração "Set and Forget" com Sugestões de IA:** O financeiro cadastra a regra. A IA sugere: *"Baseado no seu nicho (Academia), 78% dos clientes pagam via PIX às 19h. Quer que eu configure o disparo padrão para 18h45?"*.
2.  **Conciliação Automática + Anomaly Detection:** Via API bancária, identifica pagamento e dá baixa em tempo real. **Alerta automático:** *"Pagamento de R$ 500 identificado, mas fatura era R$ 450. Verificar se é adiantamento de parcela ou erro."*
3.  **Dashboard de Saúde da Carteira Preditivo:**
    *   **Fluxo de Caixa Previsto vs. Realizado** (com intervalo de confiança).
    *   **Semáforo de Inadimplência Preditivo:** Classifica clientes em **Verde (Paga em dia >90%), Amarelo (Risco 30-60%), Vermelho (Risco >70% de atraso >30 dias)** — *funciona desde o 1º mês via Cold Start + Benchmarking de Nicho*.
    *   **Churn Risk Score:** Identifica assinaturas com probabilidade de cancelamento nos próximos 60 dias (baseado em frequência de atraso, redução de uso do serviço, NPS se houver).
    *   **Otimização de Régua:** *"Se você mover o disparo do D-3 para D-5 para o segmento 'Amarelo', a recuperação sobe 12% (simulação baseada no seu histórico)."*

---

## 4. Aplicação Específica nos 7 Nichos (Com Camada de IA)

| Nicho | Caso de Uso Principal | Diferencial de IA para o Nicho |
| :--- | :--- | :--- |
| **Escolas** | Mensalidades, material didático, excursões, cursos extracurriculares. | **Previsão de evasão:** Aluno com 2+ atrasos consecutivos + falta em aulas = Alerta para coordenação pedagógica agir *antes* do pedido de transferência. |
| **Academias** | Mensalidades, Personal Trainer, suplementos recorrentes. | **Reativação Inteligente:** Detecta "fantasmas" (pagam mas não vão há 14 dias). Dispara: *"João, seu treino novo do Prof. Carlos tá pronto. Bora?"* + oferta de aula experimental de Personal. |
| **Condomínios** | Taxas extras, fundo de obras, aluguel salão, rateio gás/água. | **Rateio Dinâmico & Previsão de Caixa:** Prevê inadimplência sazonal (dezembro/janeiro) e sugere antecipação de taxa extra para obras. Prioriza cobrança de unidades com maior dívida acumulada. |
| **Farmácias** | Clube de fraldas, vitaminas, medicamentos contínuos. | **Adesão ao Tratamento:** Cruza data de compra recorrente com "janela de aderência". Se cliente de anticoncepcional/anti-hipertensivo atrasa >5 dias: *"Sua reposição tá pronta. Quer que a gente separe e você passa pegar?"* (Aumenta LTV e saúde do paciente). |
| **Padarias** | Clube café da manhã, pão assinado, kit bolo semana. | **Previsão de Demanda/Produção:** Baseado em quem confirmou pagamento (PIX pago) vs. quem só recebeu lembrete, sugere quantidade de pães/bolos a produzir no dia, reduzindo desperdício. |
| **Supermercados** | Clube ofertas exclusivas, cesta básica mensal. | **Next Best Offer:** Cliente que paga cesta básica em dia + compra cerveja aos sábados → Recebe oferta de "Kit Churrasco" na quinta-feira via WhatsApp com link de pagamento direto. |
| **Buffets e Eventos** | Parcelamento contratos, coffee breaks recorrentes, sinais de reserva. | **Gestão de Pipeline de Caixa:** Para contratos longos (casamento 12 meses), prevê quais parcelas intermediárias têm risco de atraso baseando-se no perfil financeiro do cliente (score externo opcional + comportamento interno) e antecipa negociação. |

---

## 5. A Estratégia "Cold Start": Como Entregar Valor de IA Sem Histórico Próprio
A maior barreira para IA em SaaS B2B vertical é o "problema do início frio". Nossa arquitetura resolve isso em **3 camadas**, eliminando a necessidade de migração de dados legados para o modelo funcionar:

1.  **Benchmarking de Nicho (Transfer Learning Leve):** Modelos base pré-treinados com dados anonimizados e agregados de *outros clientes do mesmo nicho* (ex: "Academias de médio porte no Sudeste têm pico de pagamento D-1 às 20h"). O modelo entra "quente" no nicho, não "frio".
2.  **Onboarding Ativo de Features (Human-in-the-Loop):** O questionário de 3 perguntas no 1º WhatsApp (Horário preferido, Canal preferido, Antecedência) + dados cadastrais básicos (Nichos, Ticket Médio, Frequência) já alimentam features categóricas potentes para o modelo (ex: `preferred_channel=PIX`, `pay_time_bucket=night`).
3.  **Aprendizado Online Rápido (Online Learning / Bandits):** Não esperamos batch mensal. Cada interação (abriu msg? clicou? pagou? ignorou?) atualiza o **Contexto do Cliente** em tempo real via *Contextual Bandits* para decisão da *próxima* mensagem (exploração vs. explotação). Em 2-3 ciclos de cobrança, o modelo pessoal supera o benchmark de nicho.

> **Resultado:** **Zero migração de dados legados necessária.** O B2B cadastra o cliente hoje, o sistema já sabe *como* cobrar amanhã melhor que o boleto estático. O passado fica no legado; o futuro inteligente roda no SaaS desde o Mês 1.

---

## 6. Arquitetura do MVP (30 Dias) — Camada de Dados & IA Inclusa

Para validar rápido, foque na integração de pagamentos, mensagens e **loop de feedback de dados**:

### 1. Backend & Motor de Regras + **Feature Store Leve**
*   Integração API PIX (Efí/Gerencianet, Mercado Pago, Stripe) → Geração PIX + Webhooks confirmação.
*   Integração API WhatsApp (Z-API, Twilio, Evolution API) → Disparo + **Webhooks de Status (Entregue, Lido, Clicou, Respondeu)** — *Crítico para features comportamentais*.
*   **Cron Job Diário Inteligente:** Não só "dispara vencimentos". Consulta **Serviço de Decisão (Decision Service)**: `GET /next-action?client_id=X` → Retorna: `{channel: "whatsapp", template: "friendly_reminder_d0", send_at: "2023-10-05T19:00:00Z", payload: {pix_link: "..."}}`.
*   **Event Collector:** Kafka/Kinesis/SQS simples → Ingeste eventos: `message_sent`, `message_read`, `link_clicked`, `payment_confirmed`, `payment_failed`. Persiste em **Data Lakehouse (ex: ClickHouse, DuckDB, Postgres + TimescaleDB)**.

### 2. **Serviço de Decisão & ML (O "Cérebro") — MVP Mínimo Viável**
*   **Regra Heurística Cold Start (Semana 1-2):** `IF first_invoice THEN use_onboarding_prefs ELSE use_benchmark_niche`. Código `if/else` versionado, testável, substituível por modelo.
*   **Feature Engineering Pipeline (Semana 2-3):** Jobs SQL/Python que materializam features por cliente/dia:
    *   *Comportamentais:* `days_since_last_payment`, `avg_payment_delay`, `preferred_hour_bucket`, `channel_success_rate_pix`, `msg_open_rate_7d`.
    *   *Contextuais:* `days_to_due`, `is_weekend`, `invoice_amount_vs_avg`.
    *   *Cadastrais:* `niche`, `plan_value`, `client_age_days`.
*   **Modelo Baseline (Semana 3-4):**
    *   **Target 1 (Propensão Pagamento D+0 a D+5):** XGBoost/LightGBM classificador binário. Treino semanal (batch) ou incremental (River/creme).
    *   **Target 2 (Melhor Horário/Canal):** Contextual Bandit (LinUCB/Thompson Sampling) por `client_id` — aprende online, não precisa retreino batch.
*   **API de Inferência (FastAPI/Flask):** Baixa latência (<50ms). Cache de predição por cliente/dia (invalida em novo evento).
*   **Fallback Seguro:** Se ML falha/baixa confiança → Regra Heurística.

### 3. Frontend B2C (A "Fatura Mágica" + Telemetria)
*   PWA super leve. **Instrumentação obrigatória:** `page_view`, `pix_button_click`, `pix_copy`, `card_select`, `payment_success`, `payment_error`. Envia para Event Collector.

### 4. Dashboard B2B (Observabilidade de Negócio + IA)
*   CRUD Clientes/Planos.
*   **Fluxo de Caixa Previsto (com banda de confiança do modelo).**
*   **Semáforo Preditivo** (Verde/Amarelo/Vermelho) + *Explicabilidade (SHAP values top 3 features)*: *"João está Vermelho porque: 1. Atraso médio 12 dias, 2. Não abre WhatsApp há 20 dias, 3. Fatura 30% acima da média."*
*   **Simulador de Régua:** *"E se eu mudar D-3 para D-5 para Amarelos?"* → Mostra % recuperação estimado (offline policy evaluation / counterfactual logging).
*   Log de entregas WhatsApp + **Métricas de Engajamento por Template/Segmento**.

---

## 7. Modelo de Negócios e Precificação (Value-Based com IA)

Cobrar apenas mensalidade fixa + take rate deixa dinheiro na mesa. A **IA é o justificativo de preço premium**.

*   **Plano Starter (Ex: R$ 149/mês):** Até 200 clientes, disparos ilimitados, **Régua Estática Inteligente (Benchmark de Nicho + Onboarding)**, 0,99% taxa transações. *Sem dashboard preditivo avançado.*
*   **Plano Pro (Ex: R$ 399/mês):** Clientes ilimitados, **IA Preditiva Ativa (Score Inadimplência, Otimização Horário/Canal, Churn Risk)**, Múltiplos usuários, Relatórios avançados, Simulador de Régua, 0,5% taxa transações.
*   **Plano Enterprise (Sob consulta):** **Modelos Customizados** (treino com dados exclusivos do cliente + dados externos opcionais - Serasa/Boa Vista via parceria), Integração ERP/CRM via API, SLA, CS dedicado.
*   **Setup Fee (Taxa de Implantação):** R$ 499 a R$ 1.999 (conforme plano). Inclui: Configuração integrações, **Workshop de Onboarding Ativo (criação das perguntas iniciais)**, Criação templates WhatsApp aprovados Meta, **Calibração inicial do Benchmark de Nicho**, Treinamento equipe.

> **Pitch de Upsell Starter → Pro:** *"Você paga R$ 250 a mais/mês. Nosso modelo prevê que recupera 5% a mais da sua inadimplência 'amarela'. Se seu faturamento mensal é R$ 100k, 5% = R$ 5k recuperados. ROI = 20x. Quer testar por 60 dias sem compromisso?"*

---

## 8. Estratégia de Go-To-Market (GTM) — Vendendo Inteligência, Não Ferramenta

1.  **A Abordagem "Fim do Constrangimento + Previsibilidade":**
    *   *Pitch:* "Seu financeiro gasta 40h/mês cobrando no escuro? Nosso sistema **prevê quem vai atrasar**, **cobra no momento certo** e **libera seu time para negociação estratégica**, não lembrete robótico."
2.  **Foco no "Dinheiro Esquecido" + "Dinheiro em Risco":** Mostre duas contas:
    *   *Recuperação Imediata:* Quanto deixa de receber por esquecimento (Régua Inteligente resolve).
    *   *Proteção de Receita Futura:* Quanto vai perder nos próximos 90 dias por churn silencioso de bons pagadores que estão desacelerando (Score Preditivo resolve).
3.  **Parceria com Contadores/Administradoras (Canais de Dados):**
    *   Eles têm a dor da conciliação **E** a confiança do dono. Ofereça: **Dashboard "Saúde Financeira do Cliente" gratuito para o Contador** (vista agregada/anônima ou com permissão). O contador vira "consultor estratégico" usando *seus* insights preditivos. Comissão recorrente 20% MRR.
4.  **Prova de Conceito (PoC) "Cold Start Real":** *"Me dê 50 clientes e 30 dias. Configuro na sexta, roda na segunda. No fim do mês, te mostro: Taxa de abertura, Taxa de conversão PIX, % recuperação inadimplência vs. seu boleto anterior. Se não bater meta X, não cobro o Setup."* Risco zero para o cliente.

---

## 9. Riscos Técnicos, de Negócio e Éticos — E Mitigações

| Risco | Mitigação |
| :--- | :--- |
| **Bloqueio do número de WhatsApp.** | Provedores API com múltiplos chips + aquecimento. Templates aprovados Meta. **IA controla frequência:** Não dispara se `msg_open_rate_7d < 20%` → Muda canal (e-mail/SMS) ou pausa e alerta humano. |
| **Cliente não tem cartão / PIX falha.** | Foco total em **PIX** (taxa baixa, sem chargeback, instantâneo). **Fallback automático:** Se PIX expira/erro → Oferta Boleto (via API bancária) ou Link Cartão no mesmo fluxo. |
| **Falha na conciliação automática (Webhook bancário cai).** | Painel "Exceções" no Dashboard (Baixa manual 2 cliques). **Job de Reprocessamento Noturno:** Varredura extrato via API bancária (Open Finance) para conciliar órfãos. |
| **Mensagem invasiva / LGPD / Reputação.** | **Copywriting Empático + Opt-out Granular:** *"Quer receber lembrete só no dia? Responda 'SÓ DIA'."* **LGPD by Design:** Dados comportamentais só para otimização de cobrança do *próprio* contrato. Não venda de dados. Auditoria de viés nos modelos (ex: não penalizar bairro/CEP). |
| **Vieses no Modelo Preditivo (Ex: Score baixo para baixa renda = menos tentativas = mais inadimplência real).** | **Fairness Constraints:** Monitorar `False Negative Rate` por segmento (ticket, nicho, tempo de casa). **Human-in-the-Loop Obrigatório para Ações Restritivas:** IA *nunca* cancela contrato ou bloqueia acesso. IA *sugere* "Ligação Humana Prioritária" para Vermelhos. |
| **Dependência de Provedor WhatsApp (Meta/APIs não-oficiais).** | Arquitetura **Multi-Channel Adapter**: Interface única `send_message(client, content)`. Implementações: `OfficialWhatsAppAPI`, `ZAPI`, `EvolutionAPI`, `EmailAdapter`, `SMSAdapter`. Troca de provedor em horas, não semanas. |
| **Cold Start não performa bem em nicho muito específico/novo.** | **Benchmark Hierárquico:** Nicho → Sub-nicho → Porte → Global. Se sub-nicho tem < 100 clientes, usa Nicho. **Active Learning:** Identifica clientes "incertos" (predição ~0.5) e força ação exploratória (testa horário/canal diferente) para gerar sinal informativo rápido. |

---

## 10. Roadmap de Evolução da IA (Pós-MVP)

| Fase | Foco | Entregável |
| :--- | :--- | :--- |
| **Fase 1 (Mês 1-3): Validação & Cold Start** | Heurísticas + Benchmark Nicho + Bandits Horário/Canal + Features básicas. | Régua adaptativa batendo boleto estático em >15% recuperação. Dashboard Preditivo "Verde/Amarelo/Vermelho" confiável (Precision@Top20% > 70%). |
| **Fase 2 (Mês 4-6): Personalização Profunda** | Modelos por Cliente (Personalized Ranking). Sequenciamento de Ações (RL/Contextual Bandits multi-step). Integração Open Finance (Dados bancários consentidos → Features renda, fluxo caixa, outros débitos). | "Próxima Melhor Ação" individual: *Pagar PIX agora? Parcelar? Mudar vencimento? Ligar?* Open Finance reduz erro de previsão de inadimplência >30%. |
| **Fase 3 (Mês 7-12): Ecossistema & Network Effects** | **Federação de Modelos (Federated Learning):** Treino global sem sair dados do cliente. **Marketplace de Réguas:** Compartilhamento anônimo de templates de alta performance entre clientes do mesmo nicho. **IA Generativa para Copywriting:** Geração automática de variações de mensagem A/B testadas pelo Bandit. | Modelo global "warm start" para novo cliente = performance Mês 3 no Dia 1. Redução CAC via indicação "Já uso e a IA me entende". |

---

### 💡 Próximos Passos Práticos (Semana 1 — Foco Execução)

Se você quer tirar essa ideia do papel, o maior desafio **não é o modelo complexo**, mas a **Engenharia de Dados & Prompt/Copywriting** para alimentar o loop.

1.  **Defina o Esquema de Eventos (Tracking Plan):** `message_sent`, `message_read`, `link_clicked`, `pix_copied`, `payment_confirmed`. Padronize `client_id`, `invoice_id`, `timestamp`, `channel`, `template_version`. **Isso é o combustível da IA.**
2.  **Escreva 5 Variações de Templates WhatsApp (A/B Test Ready):**
    *   V1: Facilitador (PIX 1 clique) — *Controle*
    *   V2: Urgência Suave ("Evite juros")
    *   V3: Benefício ("Mantenha seu desconto de pontualidade")
    *   V4: Social Proof ("90% dos seus colegas já pagaram")
    *   V5: Empático/Opção ("Tá apertado? Responda que a gente parcela")
    *   *Use placeholders dinâmicos: `{{nome}}`, `{{valor}}`, `{{pix_link}}`, `{{data_venc}}`.*
3.  **Prototipe no Figma a "Fatura Mágica" (PWA):** Tela única: Resumo fatura → Botão Grande "Pagar com PIX (Abrir Banco)" → Botão Secundário "Pagar com Cartão" → Link "Precisa de ajuda? Fale conosco". **Inclua eventos de clique no protótipo navegável.**
4.  **Monte o "Benchmark de Nicho Inicial" (Planilha mesmo):** Converse com 3 donos de Academia/Escola. Pergunte: *"Qual dia do mês a maioria paga? Que horário respondem WhatsApp? Qual % paga no PIX vs Boleto vs Cartão?"* Isso vira seu `config_niche_benchmark.json` v1.
5.  **Validação Comercial (Smoke Test):** Mostre o Figma + Planilha de Benchmark para 3 decisores. Pergunta de ouro: *"Se esse sistema rodasse sozinho, cobrasse no horário certo, me dissesse quem vai atrasar na semana que vem e me livrasse de conciliar extrato, qual o valor mensal justo? E o setup?"*
6.  **Arquitetura de Dados Mínima (Decisão Técnica Semana 1):** Escolha: **Postgres + pg_cron + pgvector (para embeddings futuros) + Python (FastAPI/APScheduler) para Decision Service** OU **Supabase (Postgres + Edge Functions + Cron + Realtime)**. Evite over-engineering (Kafka, K8s, Airflow) no Mês 1. **SQL é seu Feature Store.**

**Lembre-se:** A IA no Cold Start **é uma regra `if/else` bem informada por benchmarks de nicho + onboarding ativo + bandits de exploração**. O modelo complexo vem *depois* que o loop de dados estiver girando e validando valor. **Entregue valor na Semana 2 (Régua Inteligente Básica), itere para IA na Semana 4.**
