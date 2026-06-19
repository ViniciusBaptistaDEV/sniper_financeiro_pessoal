// api/conta-fixa.js
// POST /api/conta-fixa
// Grava o PAGAMENTO de uma conta fixa na aba "Lancamentos".
// **A peça central do cruzamento por ID:**
//   1. Recebe `conta_fixa_id` no body (obrigatório).
//   2. Valida se o id existe na aba "Contas_Fixas" → 404 se não existir.
//   3. Grava em "Lancamentos" com tipo="conta_fixa" e conta_fixa_id preenchido.
//   4. **NÃO grava `descricao`** — ela é resolvida no frontend via
//      cruzamento reverso (lookup do id na aba de contas fixas).
//      Assim, se você renomear a conta fixa, o histórico de pagamentos
//      acompanha a nova descrição automaticamente.
//
// Body esperado: { conta_fixa_id, valor, data_realizado, data_competencia,
//                   forma_pagamento, observacao }

const { addSheetRow, getSheetRows, toNumber, toInt, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'POST')) return;

    try {
        const body = req.body || {};
        const contaFixaId = toInt(body.conta_fixa_id);

        if (!contaFixaId) {
            return res.status(400).json({
                ok: false,
                error: 'O campo "conta_fixa_id" é obrigatório para pagar uma conta fixa.',
            });
        }

        // ⬇️ Validação do cruzamento: garante que o id existe na aba Contas_Fixas
        const contas = await getSheetRows('Contas_Fixas');
        const conta = contas.find((c) => toInt(c.id) === contaFixaId);
        if (!conta) {
            return res.status(404).json({
                ok: false,
                error: `Conta fixa com id=${contaFixaId} não encontrada na aba Contas_Fixas.`,
            });
        }

        const dataRealizado = body.data_realizado || new Date().toISOString().slice(0, 10);

        // Valor pago: prioriza o enviado; senão usa valor_estimado da conta fixa
        const valorPago = body.valor !== undefined && body.valor !== ''
            ? toNumber(body.valor)
            : toNumber(conta.valor_estimado);

        const row = {
            data_competencia: body.data_competencia || dataRealizado.slice(0, 7),
            data_realizado: dataRealizado,
            tipo: 'conta_fixa',
            conta_fixa_id: contaFixaId,
            // descricao propositalmente NÃO gravada — vem do cruzamento
            valor: valorPago,
            forma_pagamento: body.forma_pagamento || '',
            observacao: body.observacao || '',
        };

        const result = await addSheetRow('Lancamentos', row);
        return res.status(200).json({
            ok: true,
            id: result.id,
            row: result.row,
            conta_fixa: { id: contaFixaId, descricao: conta.descricao, valor_estimado: conta.valor_estimado },
        });
    } catch (err) {
        console.error('Erro em /api/conta-fixa:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao pagar conta fixa.' });
    }
};
