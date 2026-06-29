// api/contas-fixas.js
// Agrupador de rotas para Contas Fixas
// GET    /api/contas-fixas         -> Lista todas as contas fixas
// POST   /api/contas-fixas         -> Grava pagamento de conta fixa
// POST   /api/contas-fixas/nova     -> Cadastra nova conta fixa
// PUT    /api/contas-fixas/update   -> Atualiza conta fixa
// DELETE /api/contas-fixas/delete   -> Exclui conta fixa

const { getDoc, getSheetRows, addSheetRow, toNumber, toInt, setCors, handlePreflightOrMethod } = require('../lib/sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    const { method } = req;

    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // --- GET: Lista todas as contas fixas ---
        if (method === 'GET') {
            const contasFixas = await getSheetRows('Contas_Fixas');
            return res.status(200).json({ ok: true, contasFixas });
        }

        // --- POST: Lógica de Pagamento ou Nova Conta ---
        if (method === 'POST') {
            const body = req.body || {};

            // Caso 1: Pagamento de Conta Fixa (Possui conta_fixa_id)
            if (body.conta_fixa_id) {
                const contaFixaId = toInt(body.conta_fixa_id);
                const contas = await getSheetRows('Contas_Fixas');
                const conta = contas.find((c) => toInt(c.id) === contaFixaId);
                
                if (!conta) {
                    return res.status(404).json({ ok: false, error: `Conta fixa com id=${contaFixaId} não encontrada.` });
                }

                const dataRealizado = body.data_realizado || new Date().toISOString().slice(0, 10);
                const valorPago = body.valor !== undefined && body.valor !== ''
                    ? toNumber(body.valor)
                    : toNumber(conta.valor_estimado);

                const row = {
                    data_competencia: body.data_competencia || dataRealizado.slice(0, 7),
                    data_realizado: dataRealizado,
                    tipo: 'conta_fixa',
                    conta_fixa_id: contaFixaId,
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
            } 
            
            // Caso 2: Nova Conta Fixa (Não possui conta_fixa_id, mas tem descrição e valor_estimado)
            if (body.descricao && body.valor_estimado) {
                if (!body.dia_vencimento) {
                    return res.status(400).json({ ok: false, error: 'Campo "dia_vencimento" é obrigatório.' });
                }
                if (body.tipo === 'parcelada' && !body.total_parcelas) {
                    return res.status(400).json({ ok: false, error: 'Para conta fixa parcelada, informe "total_parcelas".' });
                }

                const row = {
                    descricao: body.descricao,
                    valor_estimado: toNumber(body.valor_estimado),
                    tipo: body.tipo || 'infinita',
                    total_parcelas: toInt(body.total_parcelas),
                    dia_vencimento: toInt(body.dia_vencimento),
                    observacao: body.observacao || '',
                };

                const result = await addSheetRow('Contas_Fixas', row);
                return res.status(200).json({ ok: true, id: result.id, row: result.row });
            }

            return res.status(400).json({ ok: false, error: 'Corpo da requisição inválido.' });
        }

        // --- PUT: Atualização ---
        if (method === 'PUT') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Contas_Fixas'];
            if (!sheet) throw new Error('Aba "Contas_Fixas" não encontrada.');

            const allRows = await sheet.getRows();
            const row = allRows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Conta fixa #${id} não encontrada.` });

            if (body.descricao !== undefined) row.set('descricao', body.descricao);
            if (body.valor_estimado !== undefined) row.set('valor_estimado', toNumber(body.valor_estimado));
            if (body.tipo !== undefined) row.set('tipo', body.tipo);
            if (body.total_parcelas !== undefined) row.set('total_parcelas', toInt(body.total_parcelas));
            if (body.dia_vencimento !== undefined) row.set('dia_vencimento', toInt(body.dia_vencimento));
            if (body.observacao !== undefined) row.set('observacao', body.observacao);

            await row.save();
            return res.status(200).json({ ok: true, message: `Conta fixa #${id} atualizada com sucesso.` });
        }

        // --- DELETE: Exclusão ---
        if (method === 'DELETE') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Contas_Fixas'];
            if (!sheet) throw new Error('Aba "Contas_Fixas" não encontrada.');

            const rows = await sheet.getRows();
            const row = rows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Conta fixa #${id} não encontrada.` });

            await row.delete();
            return res.status(200).json({ ok: true, message: `Conta fixa #${id} excluída com sucesso.` });
        }

        return res.status(405).json({ ok: false, error: 'Método não permitido.' });

    } catch (err) {
        console.error('Erro em /api/contas-fixas:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao processar requisição de contas fixas.' });
    }
};
