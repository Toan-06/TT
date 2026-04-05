fetch('http://localhost:3000/api/planner/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    destination: 'Hạ Long', 
    days: 2, 
    budget: 'Tiêu chuẩn',
    companion: 'Đi một mình',
    interests: 'Ăn hải sản và tham quan Vịnh'
  })
})
.then(res => res.json())
.then(data => console.log('✅ Planner API Result:\n', JSON.stringify(data, null, 2)))
.catch(err => console.error('❌ Planner API Error:', err));
