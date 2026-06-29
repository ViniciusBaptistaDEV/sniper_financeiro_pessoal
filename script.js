const app = {
    state: {
        token: sessionStorage.getItem('sniper_pessoal_token'),
        currentMonth: new Date().toISOString().slice(0, 7),
        contasFixas: [],
        lancamentosCache: []
    },

    init() {
        const monthInput = document.getElementById('month-filter');
        if (monthInput) monthInput.value = this.state.currentMonth;

        if (this.state.token) {
            document.getElementById('login-overlay').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            this.loadDashboard();
        }
    },

    /* ========== AUTH ========== */
    async login() {
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const loginBtn = document.getElementById('login-btn');

        const originalBtnHTML = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Verificando...';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user, pass })
            });

            if (res.ok) {
                const { token } = await res.json();
                sessionStorage.setItem('sniper_pessoal_token', token);
                window.location.reload();
            } else {
                this.openModal('acesso-negado');
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnHTML;
            }
        } catch (err) {
            this.toast('Erro na conexão com o servidor', 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnHTML;
        }
    },

    logout() {
        sessionStorage.removeItem('sniper_pessoal_token');
        localStorage.removeItem('ia_futuro_user');
        localStorage.removeItem('ia_futuro_pass');
        localStorage.removeItem('ia_futuro_auth');
        localStorage.removeItem('sniper_token');
        window.location.reload();
    },

    /* ========== HELPERS ========== */
    brl(v) {
        return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    toUpperCaseDate(str) {
        return str ? str.toUpperCase() : '';
    },

    toast(msg, type = 'success') {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = 'toast toast-' + type;
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => el.classList.add('hidden'), 3000);
    },

    showLoading() {
        document.getElementById('modal-loading')?.classList.remove('hidden');
    },

    hideLoading() {
        document.getElementById('modal-loading')?.classList.add('hidden');
    },

    async api(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.state.token,
                ...(options.headers || {})
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);
        return data;
    },
    /* ========== NAVIGATION & DROPDOWNS ========== */
    switchView(viewId) {
        document.querySelectorAll('.app-view').forEach(view => {
            view.classList.add('hidden');
            view.classList.remove('active');
        });
        const activeView = document.getElementById('view-' + viewId);
        if (activeView) {
            activeView.classList.remove('hidden');
            // Force browser reflow to trigger CSS transitions
            void activeView.offsetWidth;
            activeView.classList.add('active');
        }

        // Update active nav button styles (both desktop and mobile)
        document.querySelectorAll('.desktop-only-group .nav-btn, .mobile-menu-content .nav-btn').forEach(btn => {
            btn.classList.remove('active-nav');
        });
        
        const activeBtn = document.getElementById('nav-' + viewId);
        if (activeBtn) {
            activeBtn.classList.add('active-nav');
        }
        
        const activeMobileBtn = document.getElementById('mobile-nav-' + viewId);
        if (activeMobileBtn) {
            activeMobileBtn.classList.add('active-nav');
        }

        // Auto-close hamburger menu on mobile after view switch
        const menu = document.getElementById('mobile-menu-content');
        if (menu) {
            menu.classList.add('hidden');
        }
    },

    toggleDropdown() {
        const dropdown = document.getElementById('desktop-dropdown-lancamentos');
        const content = document.getElementById('dropdown-lancamentos-content');
        if (dropdown && content) {
            dropdown.classList.toggle('open');
            content.classList.toggle('open');
        }
    },

    /* ========== MODAIS ========== */
    toggleMobileMenu() {
        const menu = document.getElementById('mobile-menu-content');
        if (menu) menu.classList.toggle('hidden');
    },

    async openModal(tipo) {
        const modal = document.getElementById('modal-' + tipo);
        if (!modal) return;

        // Fecha o menu mobile ao abrir qualquer modal
        const menu = document.getElementById('mobile-menu-content');
        if (menu) menu.classList.add('hidden');

        this.showLoading();

        try {
            const today = new Date().toISOString().slice(0, 10);
            modal.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });
            modal.querySelectorAll('input[type="month"]').forEach(i => { if (!i.value) i.value = this.state.currentMonth; });

            if (tipo === 'pagar_conta_fixa') {
                await this.popularSelectContasFixas();
                document.getElementById('pagar-info')?.classList.add('hidden');
                const v = document.getElementById('pagar-valor'); if (v) v.value = '';
            }

            if (tipo === 'gasto') {
                await this.atualizarFormasPagamento();
                document.getElementById('gasto-credit-details')?.classList.add('hidden');
                document.getElementById('gasto-parcelas-container')?.classList.add('hidden');

                // Reset a descrição para o estado inicial
                const selectDesc = document.getElementById('gasto-descricao-select');
                if (selectDesc) {
                    selectDesc.value = '';
                    document.getElementById('gasto-descricao-manual')?.classList.add('hidden');
                }
            }

            if (tipo === 'configuracoes') {
                await this.carregarConfiguracoesNoModal();
            }

            modal.classList.remove('hidden');
        } finally {
            this.hideLoading();
        }
    },

    closeModal(tipo) {
        document.getElementById('modal-' + tipo)?.classList.add('hidden');

        // Sincroniza os dados do dashboard apenas ao fechar o modal de gasto diário
        if (tipo === 'gasto') {
            this.loadDashboard();
        }
    },

    async carregarConfiguracoesNoModal() {
        try {
            const config = await this.api('/api/configuracoes-get');

            const container = document.getElementById('config-cards-container');
            if (!container) return;

            container.innerHTML = `
                <div style="display: flex; gap: 5px;">
                    <input type="text" name="cartoes" placeholder="Ex: Nubank, Inter..." style="margin-bottom: 0;">
                    <button type="button" onclick="app.addCardField()" style="background: var(--neon-blue); border: none; color: #000; border-radius: 8px; padding: 0 10px; cursor: pointer; font-weight: bold;">+</button>
                </div>`;

            if (config.cartoes && Array.isArray(config.cartoes)) {
                config.cartoes.forEach(cartao => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.gap = '5px';
                    div.innerHTML = `
                        <input type="text" name="cartoes" value="${cartao}" placeholder="Ex: Nubank, Inter..." style="margin-bottom: 0;">
                        <button type="button" onclick="this.parentElement.remove()" style="background: #ff4d4d; border: none; color: #fff; border-radius: 8px; padding: 0 10px; cursor: pointer; font-weight: bold;">-</button>
                    `;
                    container.appendChild(div);
                });
            }

            const vaVrCheckbox = document.getElementById('has-va-vr');
            if (vaVrCheckbox) {
                vaVrCheckbox.checked = !!config.has_va_vr;
            }
        } catch (err) {
            console.error('Erro ao carregar configurações:', err);
        }
    },

    addCardField() {
        const container = document.getElementById('config-cards-container');
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '5px';
        div.innerHTML = `
            <input type="text" name="cartoes" placeholder="Ex: Nubank, Inter..." style="margin-bottom: 0;">
            <button type="button" onclick="this.parentElement.remove()" style="background: #ff4d4d; border: none; color: #fff; border-radius: 8px; padding: 0 10px; cursor: pointer; font-weight: bold;">-</button>
        `;
        container.appendChild(div);
    },

    async atualizarFormasPagamento() {
        const select = document.getElementById('gasto-forma-pagamento');
        if (!select) return;

        try {
            const config = await this.api('/api/configuracoes-get').catch(() => ({}));

            let options = `
                <option value="Pix">Pix/Débito/Dinheiro</option>
            `;

            if (config.cartoes && Array.isArray(config.cartoes) && config.cartoes.length > 0) {
                config.cartoes.forEach(cartao => {
                    options += `<option value="Crédito: ${cartao}">Cartão Crédito (${cartao})</option>`;
                });
            }

            if (config.has_va_vr) {
                options += `<option value="VA/VR">VA/VR</option>`;
            }

            select.innerHTML = options;

            // Event listener for credit card payment details
            select.onchange = () => {
                const creditDetails = document.getElementById('gasto-credit-details');
                const isCredit = select.value.startsWith('Crédito:');
                creditDetails.classList.toggle('hidden', !isCredit);
                if (!isCredit) {
                    // Reset credit fields if not credit
                    document.getElementById('gasto-tipo-pagamento').value = 'à vista';
                    document.getElementById('gasto-parcelas-container').classList.add('hidden');
                }
            };

            // Initialize credit details listeners
            const tipoPagamento = document.getElementById('gasto-tipo-pagamento');
            const parcelasContainer = document.getElementById('gasto-parcelas-container');
            const parcelasInput = document.getElementById('gasto-parcelas');

            if (tipoPagamento && parcelasContainer) {
                tipoPagamento.onchange = () => {
                    parcelasContainer.classList.toggle('hidden', tipoPagamento.value !== 'parcelado');
                };
            }

            if (parcelasInput) {
                parcelasInput.oninput = (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '');
                };
            }
        } catch (err) {
            console.error('Erro ao atualizar formas de pagamento:', err);
        } finally {
            this.hideLoading();
        }
    },

    toggleParcelas() {
        const tipo = document.getElementById('conta-tipo').value;
        const field = document.getElementById('parcelas-field');
        field.classList.toggle('hidden', tipo !== 'parcelada');
    },

    toggleDescricaoManual(valor) {
        const manualField = document.getElementById('gasto-descricao-manual');
        if (manualField) {
            manualField.classList.toggle('hidden', valor !== 'Outros');
            const input = manualField.querySelector('input');
            if (input) {
                input.required = (valor === 'Outros');
            }
        }
    },

    /* ========== CONTAS FIXAS (cruzamento por ID) ========== */
    async popularSelectContasFixas() {
        const select = document.getElementById('pagar-conta-fixa-id');
        select.innerHTML = '<option value="">Carregando...</option>';

        this.showLoading();
        try {
            const { contasFixas } = await this.api('/api/contas-fixas');
            this.state.contasFixas = contasFixas;

            if (!contasFixas.length) {
                select.innerHTML = '<option value="">Nenhuma conta fixa cadastrada</option>';
                return;
            }

            select.innerHTML = '<option value="">Selecione uma conta fixa...</option>';
            contasFixas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;                                                  // ⬅️ value = id
                opt.textContent = `${c.descricao} • Venc. dia ${c.dia_vencimento} • ${this.brl(c.valor_estimado)}`;
                opt.dataset.conta = JSON.stringify(c);
                select.appendChild(opt);
            });

            select.onchange = () => {
                const opt = select.options[select.selectedIndex];
                const info = document.getElementById('pagar-info');
                const valor = document.getElementById('pagar-valor');
                if (!opt || !opt.dataset.conta) {
                    info.classList.add('hidden'); info.innerHTML = '';
                    if (valor) valor.value = '';
                    return;
                }
                const c = JSON.parse(opt.dataset.conta);
                info.classList.remove('hidden');
                info.innerHTML = `
                    <div><b>Tipo:</b> ${c.tipo || 'infinita'}${c.total_parcelas ? ` (${c.total_parcelas}x)` : ''}</div>
                    <div><b>Valor estimado:</b> ${this.brl(c.valor_estimado)}</div>
                    <div><b>Vence todo dia:</b> ${c.dia_vencimento}</div>
                    ${c.observacao ? `<div><b>Obs:</b> ${c.observacao}</div>` : ''}
                `;
                if (valor) valor.value = Number(c.valor_estimado).toFixed(2);
            };
        } catch (err) {
            select.innerHTML = '<option value="">Erro ao carregar contas fixas</option>';
            this.toast('Erro ao carregar contas fixas', 'error');
        } finally {
            this.hideLoading();
        }
    },

    /* ========== SUBMIT DE FORMULÁRIOS ========== */
    async submitForm(e, endpoint) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Handle editing fixed account
        let isEditingContaFixa = false;
        if (endpoint === 'nova-conta-fixa' && this.state.editingContaFixaId) {
            isEditingContaFixa = true;
            endpoint = 'conta-fixa-update'; // Change endpoint to update
            data.id = this.state.editingContaFixaId;
        }

        // Handle editing informativo
        let isEditingInformativo = false;
        if (endpoint === 'informativo' && this.state.editingInformativoId) {
            isEditingInformativo = true;
            endpoint = 'informativo-update'; // Change endpoint to update
            data.id = this.state.editingInformativoId;
        }

        // Tratamento especial para campos múltiplos (como cartões de crédito)
        if (endpoint === 'configuracoes') {
            data.cartoes = formData.getAll('cartoes').filter(v => v.trim() !== '');
            data.has_va_vr = formData.get('has_va_vr') === 'on';
        }

        ['valor', 'valor_estimado', 'total_parcelas', 'dia_vencimento', 'dia_cobranca']
            .forEach(k => { if (data[k]) data[k] = Number(data[k]); });

        if (endpoint === 'conta-fixa' && !data.conta_fixa_id) {
            this.toast('Selecione uma conta fixa!', 'error');
            return;
        }

        // Mapeia endpoint -> modal-id para fechar o modal correto
        const closeMap = {
            'gasto-diario': 'gasto',
            'receita': 'receita',
            'nova-conta-fixa': 'conta_fixa',
            'conta-fixa': 'pagar_conta_fixa',
            'informativo': 'informativo',
            'configuracoes': 'configuracoes',
            'conta-fixa-update': 'conta_fixa',     // Close the same modal for update
            'informativo-update': 'informativo'    // Close the same modal for update
        };

        const loadingTexts = {
            'gasto-diario': 'Salvando gasto...',
            'receita': 'Salvando receita...',
            'nova-conta-fixa': 'Salvando conta...',
            'conta-fixa': 'Confirmando pagamento...',
            'informativo': 'Salvando informativo...',
            'configuracoes': 'Salvando configurações...',
            'conta-fixa-update': 'Atualizando conta...',
            'informativo-update': 'Atualizando informativo...'
        };

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> ${loadingTexts[endpoint] || 'Salvando...'}`;

        try {
            // Ajuste para a descrição do Gasto Diário
            if (endpoint === 'gasto-diario') {
                const selectDesc = document.getElementById('gasto-descricao-select');
                const manualDesc = document.getElementById('gasto-descricao-manual')?.querySelector('input');

                if (selectDesc && manualDesc) {
                    if (selectDesc.value === 'Outros' && manualDesc.value) {
                        data.descricao = manualDesc.value;
                    } else {
                        data.descricao = selectDesc.value;
                    }
                }
                // Remove as chaves temporárias do select/manual para não enviar ao backend
                delete data.descricao_select;
                delete data.descricao_manual;
            }

            // Determine API path and method
            let apiPath;
            let method = 'POST';
            
            if (endpoint === 'configuracoes') {
                apiPath = '/api/configuracoes';
            } else if (endpoint.endsWith('-update')) {
                apiPath = `/api/${endpoint}`;
                method = 'PUT';
            } else {
                apiPath = `/api/${endpoint}`;
            }

            await this.api(apiPath, { method: method, body: JSON.stringify(data) });
            this.toast('Salvo com sucesso!', 'success');
            
            // Clear editing state after successful save
            if (isEditingContaFixa) {
                delete this.state.editingContaFixaId;
            }
            if (isEditingInformativo) {
                delete this.state.editingInformativoId;
            }
            
            form.reset();

            if (endpoint === 'gasto-diario') {
                // Mantém o modal aberto para múltiplos lançamentos, apenas reseta os campos
                // O dashboard será atualizado apenas quando o modal for fechado manualmente
                const modal = document.getElementById('modal-gasto');
                if (modal) {
                    const today = new Date().toISOString().slice(0, 10);
                    modal.querySelectorAll('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });
                    modal.querySelectorAll('input[type="month"]').forEach(i => { if (!i.value) i.value = this.state.currentMonth; });
                    document.getElementById('gasto-credit-details')?.classList.add('hidden');
                    document.getElementById('gasto-parcelas-container')?.classList.add('hidden');
                    const selectDesc = document.getElementById('gasto-descricao-select');
                    if (selectDesc) {
                        selectDesc.value = '';
                        document.getElementById('gasto-descricao-manual')?.classList.add('hidden');
                    }
                }
            } else {
                this.closeModal(closeMap[endpoint]);
                await this.loadDashboard();
            }
        } catch (err) {

            this.toast('Erro ao salvar: ' + err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    },

    /* ========== DASHBOARD ========== */
    async loadDashboard() {
        const month = document.getElementById('month-filter')?.value || this.state.currentMonth;
        this.state.currentMonth = month;

        this.showLoading();
        try {
            const [resContas, resInformativos, resLancamentos] = await Promise.all([
                this.api('/api/contas-fixas'),
                this.api('/api/informativos'),
                this.api('/api/lancamentos?mes=' + month)
            ]);

            const contasFixas = Array.isArray(resContas?.contasFixas) ? resContas.contasFixas : [];
            const informativos = Array.isArray(resInformativos?.informativos) ? resInformativos.informativos : [];
            const lancamentos = Array.isArray(resLancamentos?.lancamentos) ? resLancamentos.lancamentos : [];

            this.state.contasFixas = contasFixas;
            this.state.informativos = informativos;
            this.state.lancamentosCache = lancamentos;

            // ⬇️ Índice por ID para cruzamento O(1)
            const contaById = Object.fromEntries(contasFixas.map(c => [String(c.id), c]));

            let totalReceitas = 0, totalGastos = 0, totalContasPagas = 0;
            lancamentos.forEach(l => {
                const v = Number(l.valor) || 0;
                if (l.tipo === 'receita') totalReceitas += v;
                else if (l.tipo === 'gasto_diario') totalGastos += v;
                else if (l.tipo === 'conta_fixa') totalContasPagas += v;
            });

            document.getElementById('sum-receitas').textContent = this.brl(totalReceitas);
            document.getElementById('sum-gastos').textContent = this.brl(totalGastos);
            document.getElementById('sum-contas').textContent = this.brl(totalContasPagas);
            document.getElementById('sum-saldo').textContent = this.brl(totalReceitas - totalGastos - totalContasPagas);

            this.renderContasFixas(contasFixas, lancamentos.filter(l => l.tipo === 'conta_fixa'), contaById);
            this.renderInformativos(Array.isArray(informativos) ? informativos : []);
            this.renderLancamentos(lancamentos, contaById);

            // Calcula médias móveis após carregamento principal
            await this.calculateMovingAverages();
        } catch (err) {
            this.toast('Erro ao carregar dashboard: ' + err.message, 'error');
        } finally {
            this.hideLoading();
        }
    },

    renderContasFixas(contasFixas, pagamentos, contaById) {
        const el = document.getElementById('contas-fixas-list');
        if (!contasFixas.length) {
            el.innerHTML = '<p class="empty-msg">Nenhuma conta fixa cadastrada.</p>';
            return;
        }
        const hoje = new Date();
        el.innerHTML = contasFixas.map(c => {
            const pago = pagamentos.find(p => String(p.conta_fixa_id) === String(c.id));
            const venc = new Date(hoje.getFullYear(), hoje.getMonth(), c.dia_vencimento);
            const status = pago
                ? '<span class="badge badge-green">Paga</span>'
                : (venc < hoje ? '<span class="badge badge-yellow">Atrasada</span>'
                    : '<span class="badge badge-gray">Pendente</span>');
            return `
                <div class="item-card">
                    <div class="item-title">
                        <span>${c.descricao}</span>
                        ${status}
                    </div>
                    <div class="item-meta">
                        <span>Dia ${c.dia_vencimento}</span>
                        <span>${c.tipo || 'infinita'}${c.total_parcelas ? ` • ${c.total_parcelas}x` : ''}</span>
                    </div>
                    <div class="item-value txt-orange">${this.brl(c.valor_estimado)}</div>
                    ${pago ? `<div class="item-meta"><span>Pago em ${this.toUpperCaseDate(pago.data_realizado)} • ${this.brl(pago.valor)}</span></div>` : ''}
                    <div class="item-actions">
                        <button class="item-action-btn btn-edit" onclick="app.abrirModalEdicaoContaFixa('${c.id}')" title="Editar">✏️</button>
                        <button class="item-action-btn btn-delete" onclick="app.abrirModalExclusaoContaFixa('${c.id}')" title="Excluir">🗑</button>
                    </div>
                </div>`;
        }).join('');
    },

    renderInformativos(list) {
        const el = document.getElementById('informativos-list');
        if (!list.length) {
            el.innerHTML = '<p class="empty-msg">Nenhum informativo cadastrado.</p>';
            return;
        }
        el.innerHTML = list.map(i => `
            <div class="item-card">
                <div class="item-title">
                    <span>${i.servico}</span>
                    <span class="badge badge-blue">${i.modalidade || 'Mensal'}</span>
                </div>
                <div class="item-meta">
                    <span>Cobra dia ${i.dia_cobranca}</span>
                    ${i.cartao_destino ? `<span>${i.cartao_destino}</span>` : ''}
                </div>
                ${i.observacao ? `<div class="item-meta"><span>${i.observacao}</span></div>` : ''}
                <div class="item-actions">
                    <button class="item-action-btn btn-edit" onclick="app.abrirModalEdicaoInformativo('${i.id}')" title="Editar">✏️</button>
                    <button class="item-action-btn btn-delete" onclick="app.abrirModalExclusaoInformativo('${i.id}')" title="Excluir">🗑</button>
                </div>
            </div>`).join('');
    },

    renderLancamentos(list, contaById) {
        const el = document.getElementById('lancamentos-list');
        if (!list.length) {
            el.innerHTML = '<p class="empty-msg">Nenhum lançamento neste mês.</p>';
            return;
        }
        el.innerHTML = list.map(l => {
            let descricao = l.descricao;
            let badge = '';
            if (l.tipo === 'conta_fixa' && l.conta_fixa_id) {
                const conta = contaById[String(l.conta_fixa_id)];
                descricao = conta ? conta.descricao : `(Conta #${l.conta_fixa_id} removida)`;
                badge = '<span class="badge badge-orange">Conta Fixa</span>';
            } else if (l.tipo === 'receita') {
                badge = '<span class="badge badge-green">Receita</span>';
            } else {
                badge = '<span class="badge badge-purple">Gasto</span>';
            }
            return `
                <div class="item-card">
                    <div class="item-title">
                        <span>${descricao}</span>
                        ${badge}
                    </div>
                    <div class="item-meta">
                        <span>${this.toUpperCaseDate(l.data_realizado)}</span>
                        ${l.forma_pagamento ? `<span>${l.forma_pagamento}</span>` : ''}
                        ${l.tipo_pagamento && l.tipo_pagamento !== 'à vista' && l.parcelas ? `<span class="badge badge-gray">${l.parcelas}x</span>` : ''}
                        ${l.tipo_pagamento && l.tipo_pagamento === 'parcelado' && !l.parcelas ? `<span class="badge badge-gray">Parcelado</span>` : ''}
                    </div>
                    <div class="item-value ${l.tipo === 'receita' ? 'txt-green' : l.tipo === 'conta_fixa' ? 'txt-orange' : 'txt-purple'}">
                        ${l.tipo === 'receita' ? '+' : '-'} ${this.brl(l.valor)}
                    </div>
                    <div class="item-actions">
                        <button class="item-action-btn btn-edit" onclick="app.abrirModalEdicao('${l.id}')" title="Editar">✏️</button>
                        <button class="item-action-btn btn-delete" onclick="app.abrirModalExclusao('${l.id}')" title="Excluir">🗑</button>
                    </div>
                </div>`;
        }).join('');
    },

    async calculateMovingAverages() {
        const currentMonth = this.state.currentMonth;
        const targetMonths = [3, 6];
        const metrics = {
            receitas: { '3m': 0, '6m': 0 },
            gastos: { '3m': 0, '6m': 0 }
        };

        for (const m of targetMonths) {
            let sumReceitas = 0;
            let sumGastos = 0;
            let monthsCounted = 0;

            for (let i = 0; i < m; i++) {
                const d = new Date(currentMonth + '-01');
                d.setMonth(d.getMonth() - i);
                const monthKey = d.toISOString().slice(0, 7);

                try {
                    const res = await this.api(`/api/lancamentos?mes=${monthKey}`);
                    const lancamentos = Array.isArray(res?.lancamentos) ? res.lancamentos : [];
                    
                    let monthlyReceita = 0;
                    let monthlyGasto = 0;

                    lancamentos.forEach(l => {
                        const v = Number(l.valor) || 0;
                        if (l.tipo === 'receita') monthlyReceita += v;
                        else if (l.tipo === 'gasto_diario' || l.tipo === 'conta_fixa') monthlyGasto += v;
                    });

                    sumReceitas += monthlyReceita;
                    sumGastos += monthlyGasto;
                    monthsCounted++;
                } catch (e) {
                    console.error(`Erro ao buscar médias para ${monthKey}:`, e);
                }
            }

            metrics.receitas[`${m}m`] = sumReceitas / monthsCounted;
            metrics.gastos[`${m}m`] = sumGastos / monthsCounted;
        }

        document.getElementById('avg-receita-3m').textContent = this.brl(metrics.receitas['3m']);
        document.getElementById('avg-receita-6m').textContent = this.brl(metrics.receitas['6m']);
        document.getElementById('avg-gastos-3m').textContent = this.brl(metrics.gastos['3m']);
        document.getElementById('avg-gastos-6m').textContent = this.brl(metrics.gastos['6m']);
    },

    /* ========== FUNÇÕES DE EDITAR E EXCLUIR ========== */
    abrirModalExclusao(id) {
        const item = this.state.lancamentosCache.find(l => String(l.id) === String(id));
        if (!item) return;

        this.state.itemExclusao = { id, tipo: 'lancamento' };

        let desc = item.descricao;
        if (item.tipo === 'conta_fixa' && item.conta_fixa_id) {
            const conta = this.state.contasFixas.find(c => String(c.id) === String(item.conta_fixa_id));
            if (conta) desc = conta.descricao;
        }

        const previewEl = document.getElementById('delete-item-preview');
        if (previewEl) {
            previewEl.innerHTML = `
                <div style="background:#1d1d20; padding:12px; border-radius:8px; border:1px solid #ff4d4d33; margin-top:10px; color: #fff;">
                    <strong>${desc}</strong><br>
                    <span style="color: #ff4d4d;">Valor: ${this.brl(item.valor)}</span><br>
                    <span style="font-size: 0.85rem; color: #aaa;">Data: ${item.data_realizado}</span>
                </div>`;
        }

        this.openModal('confirmar-exclusao');
    },

    abrirModalExclusaoContaFixa(id) {
        const item = this.state.contasFixas.find(c => String(c.id) === String(id));
        if (!item) return;

        this.state.itemExclusao = { id, tipo: 'conta_fixa' };

        const previewEl = document.getElementById('delete-item-preview');
        if (previewEl) {
            previewEl.innerHTML = `
                <div style="background:#1d1d20; padding:12px; border-radius:8px; border:1px solid #ff4d4d33; margin-top:10px; color: #fff;">
                    <strong>${item.descricao}</strong><br>
                    <span style="color: #ff4d4d;">Valor Estimado: ${this.brl(item.valor_estimado)}</span><br>
                    <span style="font-size: 0.85rem; color: #aaa;">Vencimento: Dia ${item.dia_vencimento}</span>
                </div>`;
        }

        this.openModal('confirmar-exclusao');
    },

    abrirModalExclusaoInformativo(id) {
        const item = this.state.informativos?.find(i => String(i.id) === String(id)) || 
                     this.state.contasFixas.find(i => String(i.id) === String(id)); // Fallback or check state
        
        // If not in state, we should ideally have it from loadDashboard
        // Let's try to find it in the state. Since renderInformativos doesn't save to stateC, 
        // I should update loadDashboard to save informativos to state.
        
        // Temporary fix to handle finding the item
        const foundItem = this.state.informativos?.find(i => String(i.id) === String(id));

        if (!foundItem) {
            this.toast('Informativo não encontrado', 'error');
            return;
        }

        this.state.itemExclusao = { id, tipo: 'informativo' };

        const previewEl = document.getElementById('delete-item-preview');
        if (previewEl) {
            previewEl.innerHTML = `
                <div style="background:#1d1d20; padding:12px; border-radius:8px; border:1px solid #ff4d4d33; margin-top:10px; color: #fff;">
                    <strong>${foundItem.servico}</strong><br>
                    <span style="color: #ff4d4d;">Cobrança: Dia ${foundItem.dia_cobranca}</span><br>
                    <span style="font-size: 0.85rem; color: #aaa;">Modalidade: ${foundItem.modalidade}</span>
                </div>`;
        }

        this.openModal('confirmar-exclusao');
    },

    async confirmarExclusao() {
        const item = this.state.itemExclusao;
        if (!item) return;

        const btn = document.getElementById('btn-confirmar-exclusao');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = 'Excluindo...';
        btn.disabled = true;

        let endpoint = '/api/lancamento-delete';
        if (item.tipo === 'conta_fixa') endpoint = '/api/conta-fixa-delete';
        if (item.tipo === 'informativo') endpoint = '/api/informativo-delete';

        try {
            await this.api(endpoint, {
                method: 'DELETE',
                body: JSON.stringify({ id: item.id })
            });

            this.toast('Item excluído com sucesso!', 'success');
            this.closeModal('confirmar-exclusao');
            this.loadDashboard();
        } catch (err) {
            this.toast('Erro ao excluir: ' + err.message, 'error');
        } finally {
            btn.innerHTML = txtOriginal;
            btn.disabled = false;
        }
    },

    abrirModalEdicao(id) {
        const item = this.state.lancamentosCache.find(l => String(l.id) === String(id));
        if (!item) return;

        document.getElementById('edit-lancamento-id').value = item.id;

        let desc = item.descricao;
        if (item.tipo === 'conta_fixa' && item.conta_fixa_id) {
            const conta = this.state.contasFixas.find(c => String(c.id) === String(item.conta_fixa_id));
            if (conta) desc = conta.descricao;
            document.getElementById('edit-descricao').readOnly = true;
        } else {
            document.getElementById('edit-descricao').readOnly = false;
        }

        document.getElementById('edit-descricao').value = desc || '';
        document.getElementById('edit-valor').value = Number(item.valor).toFixed(2);
        document.getElementById('edit-data-realizado').value = item.data_realizado || '';
        document.getElementById('edit-data-competencia').value = item.data_competencia || '';
        document.getElementById('edit-forma-pagamento').value = item.forma_pagamento || '';
        document.getElementById('edit-observacao').value = item.observacao || '';

        this.openModal('editar-lancamento');
    },

    async submitEditarLancamento(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;

        const id = document.getElementById('edit-lancamento-id').value;
        const itemOriginal = this.state.lancamentosCache.find(l => String(l.id) === String(id));

        const payload = {
            id: id,
            descricao: document.getElementById('edit-descricao').value,
            valor: Number(document.getElementById('edit-valor').value),
            data_realizado: document.getElementById('edit-data-realizado').value,
            data_competencia: document.getElementById('edit-data-competencia').value,
            forma_pagamento: document.getElementById('edit-forma-pagamento').value,
            observacao: document.getElementById('edit-observacao').value
        };

        if (itemOriginal) {
            payload.tipo = itemOriginal.tipo;
            if (itemOriginal.conta_fixa_id) {
                payload.conta_fixa_id = itemOriginal.conta_fixa_id;
            }
        }

        // Adiciona campos de crédito se existirem no item original
        if (itemOriginal.tipo_pagamento) payload.tipo_pagamento = itemOriginal.tipo_pagamento;
        if (itemOriginal.parcelas) payload.parcelas = itemOriginal.parcelas;

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner"></span> Salvando alterações...`;

        try {
            await this.api('/api/lancamento-update', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            this.toast('Lançamento atualizado com sucesso!', 'success');
            this.closeModal('editar-lancamento');
            await this.loadDashboard();
        } catch (err) {
            this.toast('Erro ao editar: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    },

    abrirModalEdicaoContaFixa(id) {
        const item = this.state.contasFixas.find(c => String(c.id) === String(id));
        if (!item) return;

        // Populate the nova-conta-fixa modal form
        const modal = document.getElementById('modal-conta_fixa');
        modal.querySelector('input[name="descricao"]').value = item.descricao;
        modal.querySelector('input[name="valor_estimado"]').value = item.valor_estimado;
        modal.querySelector('select[name="tipo"]').value = item.tipo;
        
        // Toggle parcelas field if needed
        const parcelasField = document.getElementById('parcelas-field');
        if (item.tipo === 'parcelada') {
            parcelasField.classList.remove('hidden');
            modal.querySelector('input[name="total_parcelas"]').value = item.total_parcelas || '';
        } else {
            parcelasField.classList.add('hidden');
            modal.querySelector('input[name="total_parcelas"]').value = '';
        }
        
        modal.querySelector('input[name="dia_vencimento"]').value = item.dia_vencimento;
        modal.querySelector('textarea[name="observacao"]').value = item.observacao || '';

        // Store the ID for when we submit the form
        this.state.editingContaFixaId = item.id;

        this.openModal('conta_fixa');
    },

    abrirModalEdicaoInformativo(id) {
        const item = this.state.informativos.find(i => String(i.id) === String(id));
        if (!item) return;

        // Populate the informativo modal form
        const modal = document.getElementById('modal-informativo');
        modal.querySelector('input[name="servico"]').value = item.servico;
        modal.querySelector('input[name="dia_cobranca"]').value = item.dia_cobranca;
        modal.querySelector('input[name="cartao_destino"]').value = item.cartao_destino || '';
        modal.querySelector('select[name="modalidade"]').value = item.modalidade || 'Mensal';
        modal.querySelector('textarea[name="observacao"]').value = item.observacao || '';

        // Store the ID for when we submit the form
        this.state.editingInformativoId = item.id;

        this.openModal('informativo');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}