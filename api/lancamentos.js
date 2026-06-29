// api/lancamentos.js
// Agrupador de rotas para Lançamentos
// GET    /api/lancamentos         -> Lista lançamentos (com filtro de mês)
// PUT    /api/lancamentos/update   -> Atualiza um lançamento
// DELETE /api/lancamentos/delete   -> Exclui um lançamento

const { getDoc, getSheetRows, toNumber, setCors } = require('../lib/sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    const { method } = req;

    if (method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // --- GET: Lista lançamentos ---
        if (method === 'GET') {
            const { mes } = req.query;
            let lancamentos = await getSheetRows('Lancamentos');

            if (mes && /^\d{4}-\d{2}$/.test(mes)) {
                lancamentos = lancamentos.filter((l) => {
                    const comp = String(l.data_competencia || '').slice(0, 7);
                    return comp === mes;
                });
            }
            return res.status(200).json({ ok: true, lancamentos });
        }

        // --- PUT: Atualização ---
        if (method === 'PUT') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Lancamentos'];
            if (!sheet) throw new Error('Aba "Lancamentos" não encontrada.');

            const rows = await sheet.getRows();
            const row = rows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Lançamento #${id} não encontrado.` });

            if (body.descricao !== undefined) row.set('descricao', body.descricao);
            if (body.valor !== undefined)     row.set('valor', toNumber(body.valor));
            if (body.data_realizado !== undefined)   row.set('data_realizado', body.data_realizado);
            if (body.data_competencia !== undefined) row.set('data_competencia', body.data_competencia);
            if (body.forma_pagamento !== undefined)  row.set('forma_pagamento', body.forma_pagamento);
            if (body.tipo_pagamento !== undefined)    row.set('tipo_pagamento', body.tipo_pagamento);
            if (body.parcelas !== undefined)          row.set('parcelas', body.parcelas);
            if (body.observacao !== undefined)       row.set('observacao', body.observacao);

            await row.save();
            return res.status(200).json({ ok: true, message: `Lançamento #${id} atualizado com sucesso.` });
        }

        // --- DELETE: Exclusão ---
        if (method === 'DELETE') {
            const body = req.body || {};
            const id = parseInt(body.id, 10);
            if (!id || isNaN(id)) return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });

            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['Lancamentos'];
            if (!sheet) throw new Error('Aba "Lancamentos" não encontrada.');

            const rows = await sheet.getRows();
            const row = rows.find(r => parseInt(r.get('id'), 10) === id);
            if (!row) return res.status(404).json({ ok: false, error: `Lançamento #${id} não encontrado.` });

            await row.delete();
            return res.status(200).json({ ok: true, message: `Lançamento #${id} excluído com sucesso.` });
        }

        return res.status(405).json({ ok: false, error: 'Método não permitido.' });

    } catch (err) {
        console.error('Erro em /api/lancamentos:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao processar lançamentos.' });
    }
};
