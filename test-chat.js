fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Xin chào', prefs: {} })
})
.then(res => res.json())
.then(data => console.log('Chạy thử Chat API:', JSON.stringify(data, null, 2)))
.catch(err => console.error('Lỗi khi gọi API chat:', err));
