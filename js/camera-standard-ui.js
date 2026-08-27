const resolutionSelect=document.getElementById('resolutionSelect');
if(resolutionSelect){
  resolutionSelect.innerHTML='<option value="1080" selected>Telefon standardı · otomatik</option>';
  resolutionSelect.value='1080';
  resolutionSelect.disabled=true;
  resolutionSelect.title='Kamera çözünürlüğünü kullanılan telefon ve tarayıcı otomatik belirler';
  const label=resolutionSelect.closest('.dock-control')?.querySelector('span');
  if(label)label.textContent='Kamera Kalitesi';
}
