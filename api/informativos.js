// api/informativos.js
// Agrupador de rotas para Informativos
// GET    /api/informativos         -> Lista todos os informativos
// POST   /api/informativos         -> Grava novo informativo
// PUT    /api/informativos/update   -> Atualiza informativo
// DELETE /api/informativos/delete   -> Exclui informativo

const { getDoc, getSheetRows, addSheetRow, toInt, setCors, handlePreflightOrMethod } = require('../lib/sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    const { method } = req;

    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // --- GET: Lista informativos ---
        if (method === 'GET') {
            const informativos = await getSheetRows('Informativos');
            return res.status(200).json({ ok: true, informativos });
        }

        // --- POST: Novo informativo ---
        if (method === 'POST') {
            const body = req.body || {};
            if (!body.servico || !body.dia_cobranca) {
                return res.status(400).json({ ok: false, error: 'Campos "servico" e "dia_cobranca" são obrigatórios.' });
            }

            const row = {
                servico: body.servico,
                dia_cobranca: toInt(body.dia_cobranca),
                cartao_destino: body.cartao_destino || '',
                modalidade: body.modalidade || 'Mensal',
                observacao: body.observacao || '',
            };

            const result = await addSheetRow('Informativos', row);
            return res.status(200).json({ ok: true, id: result.id, row: result.row });
        }

        // --- PUT: Atualização ---
        if (method === 'PUT') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Informativos'];
            if (!sheet) throw new Error('Aba "Informativos" não encontrada.');

            const allRows = await sheet.getRows();
            const row = allRows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Informativo #${id} não encontrado.` });

            if (body.servico !== undefined) row.set('servico', body.servico);
            if (body.dia_cobranca !== undefined) row.set('dia_cobranca', toInt(body.dia_cobranca));
            if (body.cartao_destino !== undefined) row.set('cartao_destino', body.cartao_destino);
            if (body.modalidade !== undefined) row.set('modalidade', body.modalidade);
            if (body.observacao !== undefined) row.set('observacao', body.observacao);

            await row.save();
            return res.status(200).json({ ok: true, message: `Informativo #${id} atualizado com sucesso.` });
        }

        // --- DELETE: Exclusão ---
        if (method === 'DELETE') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Informativos'];
            if (!sheet) throw new Error('Aba "Informativos" não encontrada.');

            const rows = await sheet.getRows();
            const row = rows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Informativo #${id} não encontrado.` });

            await row.delete();
            return res.status(200).json({ ok: true, message: `Informativo #${id} excluído com sucesso.` });
        }

        return res.status(405).json({ ok: false, error: 'Método não permitido.' });

    } catch (err) {
        console.error('Erro em /api/informativos:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao processar requisição de informativos.' });
    }
};
