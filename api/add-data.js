// api/add-data.js
// Recebe POST com { type, ...payload } e grava na aba correta.
//   - type = "gasto_diario"     -> grava na aba Lancamentos
//   - type = "receita"          -> grava na aba Lancamentos
//   - type = "conta_fixa"       -> grava na aba Lancamentos (PAGAMENTO de uma conta fixa)
//                                  *requer* o campo `conta_fixa_id` no body
//   - type = "nova_conta_fixa"  -> grava na aba Contas_Fixas
//   - type = "informativo"      -> grava na aba Informativos
const { addSheetRow, getSheetRows } = require('./sheets-helper');

const SHEET_BY_TYPE = {
    gasto_diario: 'Lancamentos',
    receita: 'Lancamentos',
    conta_fixa: 'Lancamentos',
    nova_conta_fixa: 'Contas_Fixas',
    informativo: 'Informativos',
};

function toNumber(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

function toInt(v) {
    if (v === undefined || v === null || v === '') return 0;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Método não permitido.' });
    }

    try {
        const body = req.body || {};
        const { type } = body;
        const sheetTitle = SHEET_BY_TYPE[type];
        if (!sheetTitle) {
            return res.status(400).json({
                ok: false,
                error: `Tipo "${type}" inválido. Use: gasto_diario, receita, conta_fixa, nova_conta_fixa ou informativo.`,
            });
        }

        let rowPayload = {};

        if (sheetTitle === 'Lancamentos') {
            // ----- Pagamento de conta fixa: requer conta_fixa_id válido -----
            if (type === 'conta_fixa') {
                const contaFixaId = toInt(body.conta_fixa_id);
                if (!contaFixaId) {
                    return res.status(400).json({
                        ok: false,
                        error: 'Para pagar uma conta fixa é obrigatório informar conta_fixa_id.',
                    });
                }
                // Valida que o id existe na aba Contas_Fixas
                const contas = await getSheetRows('Contas_Fixas');
                const conta = contas.find((c) => toInt(c.id) === contaFixaId);
                if (!conta) {
                    return res.status(404).json({
                        ok: false,
                        error: `Conta fixa com id=${contaFixaId} não encontrada.`,
                    });
                }

                const dataRealizado = body.data_realizado || new Date().toISOString().slice(0, 10);
                // Valor pago: prioriza o enviado; senão usa valor_estimado
                const valorPago = body.valor !== undefined && body.valor !== ''
                    ? toNumber(body.valor)
                    : toNumber(conta.valor_estimado);

                rowPayload = {
                    data_competencia: body.data_competencia || dataRealizado.slice(0, 7),
                    data_realizado: dataRealizado,
                    tipo: 'conta_fixa',
                    conta_fixa_id: contaFixaId,
                    descricao: body.descricao || conta.descricao || '',
                    valor: valorPago,
                    forma_pagamento: body.forma_pagamento || '',
                    observacao: body.observacao || '',
                };
            } else {
                // gasto_diario ou receita
                const tipoLanc = type === 'receita' ? 'receita' : 'gasto_diario';
                const dataRealizado = body.data_realizado || new Date().toISOString().slice(0, 10);
                rowPayload = {
                    data_competencia: body.data_competencia || dataRealizado.slice(0, 7),
                    data_realizado: dataRealizado,
                    tipo: tipoLanc,
                    conta_fixa_id: '', // mantém a coluna sempre presente (vazia)
                    descricao: body.descricao || '',
                    valor: toNumber(body.valor),
                    forma_pagamento: body.forma_pagamento || '',
                    observacao: body.observacao || '',
                };
            }
        } else if (sheetTitle === 'Contas_Fixas') {
            rowPayload = {
                descricao: body.descricao || '',
                valor_estimado: toNumber(body.valor_estimado),
                tipo: body.tipo || 'infinita', // "infinita" | "parcelada"
                total_parcelas: toInt(body.total_parcelas),
                dia_vencimento: toInt(body.dia_vencimento),
                observacao: body.observacao || '',
            };
        } else if (sheetTitle === 'Informativos') {
            rowPayload = {
                servico: body.servico || '',
                dia_cobranca: toInt(body.dia_cobranca),
                cartao_destino: body.cartao_destino || '',
                modalidade: body.modalidade || '',
                observacao: body.observacao || '',
            };
        }

        const result = await addSheetRow(sheetTitle, rowPayload);
        return res.status(200).json({
            ok: true,
            type,
            sheet: sheetTitle,
            id: result.id,
            row: result.row,
        });
    } catch (err) {
        console.error('Erro em /api/add-data:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao adicionar.' });
    }
};
