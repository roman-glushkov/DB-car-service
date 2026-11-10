// Административные формы для основных справочников.
async function openCarModal(id = null) {
  const [cars, clients] = await Promise.all([api('/api/cars'), api('/api/car-clients')]);
  const found = id ? cars.find(x => Number(x.car_id) === id) : null;
  if (id && !found) throw Error('Автомобиль не найден');
  const body = `<form id="carForm"><div class="app-form-grid">
    <label class="app-field app-field-full">Владелец<select name="client_id" required><option value="">Выберите клиента</option>${clients.map(x=>`<option value="${Number(x.client_id)}" ${Number(found?.client_id)===Number(x.client_id)?'selected':''}>${esc(x.full_name)}</option>`).join('')}</select></label>
    <label class="app-field">Марка<input name="brand" required maxlength="50" value="${esc(found?.brand || '')}"></label>
    <label class="app-field">Модель<input name="model" required maxlength="50" value="${esc(found?.model || '')}"></label>
    <label class="app-field">VIN (17 символов, без I/O/Q)<input name="vin" maxlength="17" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" value="${esc(found?.vin || '')}"></label>
    <label class="app-field">Госномер<input name="license_plate" maxlength="15" value="${esc(found?.license_plate || '')}"></label>
    <label class="app-field">Год выпуска<input name="year" type="number" min="1886" max="${new Date().getFullYear()+1}" value="${esc(found?.year ?? '')}"></label>
    </div><div class="modal-error" hidden></div><div class="app-modal-actions"><button type="button" class="action-btn" data-modal-close>Отмена</button><button type="submit" class="action-btn action-btn-primary">Сохранить</button></div></form>`;
  const modal = modalShell(found ? 'Редактирование автомобиля' : 'Новый автомобиль','Автосервис · автомобили',body);
  const form = modal.querySelector('form');
  form.addEventListener('submit', async e=>{
    e.preventDefault(); const submit=form.querySelector('[type="submit"]'); const error=form.querySelector('.modal-error');
    submit.disabled=true; error.hidden=true;
    try {const data=Object.fromEntries(new FormData(form)); data.vin=data.vin.trim().toUpperCase();
      await api(found?`/api/cars/${id}`:'/api/cars',{method:found?'PUT':'POST',body:JSON.stringify(data)});
      modal.remove(); await render();
    } catch(e){error.textContent=e.message;error.hidden=false;submit.disabled=false;}
  });
}
async function openPartModal(id = null) {
  const parts=await api('/api/parts');const found=id?parts.find(x=>Number(x.part_id)===id):null;
  if(id&&!found)throw Error('Запчасть не найдена');
  const fields=[['name','Название','text',150,true],['part_type','Тип','text',100,false],['article','Артикул','text',50,false],['manufacturer','Производитель','text',100,false],['stock_quantity','Количество на складе','number',null,true],['price','Цена, ₽','number',null,true]];
  const body=`<form id="partForm"><div class="app-form-grid">${fields.map(([field,label,type,max,required])=>`<label class="app-field">${label}<input name="${field}" type="${type}" ${max?`maxlength="${max}"`:''} ${required?'required':''} ${type==='number'?`min="0" step="${field==='stock_quantity'?'1':'0.01'}"`:''} value="${esc(found?.[field] ?? (type==='number'?0:''))}"></label>`).join('')}</div><div class="modal-error" hidden></div><div class="app-modal-actions"><button type="button" class="action-btn" data-modal-close>Отмена</button><button type="submit" class="action-btn action-btn-primary">Сохранить</button></div></form>`;
  const modal=modalShell(found?'Редактирование запчасти':'Новая запчасть','Склад автосервиса',body);const form=modal.querySelector('form');
  form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]'),error=form.querySelector('.modal-error');button.disabled=true;error.hidden=true;
    try {const data=Object.fromEntries(new FormData(form));await api(found?`/api/parts/${id}`:'/api/parts',{method:found?'PUT':'POST',body:JSON.stringify(data)});modal.remove();await render();}
    catch(e){error.textContent=e.message;error.hidden=false;button.disabled=false;}
  });
}
const DELETE_TYPES = {cars:'автомобиль',parts:'запчасть',clients:'клиента','work-types':'вид работы',payments:'оплату'};
async function deleteAdminRecord(kind,id) {
  if (!DELETE_TYPES[kind] || !Number.isSafeInteger(id) || id <= 0) return;
  if(!confirm(`Удалить ${DELETE_TYPES[kind]} #${id}? При наличии связанных заказов сервер запретит удаление.`))return;
  await api(`/api/${kind}/${id}`,{method:'DELETE'});await render();
}
async function removeCarPhoto(id) {
  if(!confirm('Удалить фотографию автомобиля?'))return;
  await api(`/api/cars/${id}/photo`,{method:'DELETE'});await render();
}

async function openPaymentModal(){
  const orders=await api('/api/orders');
  if(!orders.length){alert('Сначала создайте заказ.');return;}
  const body=`<form id="paymentForm"><div class="app-form-grid"><label class="app-field app-field-full">Заказ<select name="order_id" required>${orders.map(x=>`<option value="${Number(x.order_id)}">#${Number(x.order_id)} · ${esc(x.brand)} ${esc(x.model)} · ${esc(x.client_name)}</option>`).join('')}</select></label><label class="app-field">Сумма, ₽<input name="amount" type="number" min="0.01" step="0.01" required></label><label class="app-field">Способ<select name="payment_method" required><option>Карта</option><option>Наличные</option><option>Перевод</option></select></label></div><div class="modal-error" hidden></div><div class="app-modal-actions"><button type="button" class="action-btn" data-modal-close>Отмена</button><button type="submit" class="action-btn action-btn-primary">Зачислить</button></div></form>`;
  const modal=modalShell('Новая оплата','Заказ-наряды и финансы',body);
  const form=modal.querySelector('form');
  form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('[type="submit"]'),error=form.querySelector('.modal-error');btn.disabled=true;error.hidden=true;try{await api('/api/payments',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});modal.remove();await render();}catch(e){error.textContent=e.message;error.hidden=false;btn.disabled=false;}});
}
