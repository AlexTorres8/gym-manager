import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import './App.css'

// --- 🔒 CONTRASEÑA MAESTRA ---
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

function App() {
  // --- ESTADOS DE SEGURIDAD ---
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')

  // --- ESTADOS GLOBALES ---
  const [currentView, setCurrentView] = useState('reception') 
  const [allClients, setAllClients] = useState([]) // Lista completa de socios
  
  // --- ESTADOS DE RECEPCIÓN ---
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState([])
  const [visits, setVisits] = useState([])
  
  // Modales y Formularios
  const [showClientModal, setShowClientModal] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  
  // Edición
  const [editingClient, setEditingClient] = useState(null)
  
  const [clientForm, setClientForm] = useState({ first_name: '', last_name: '', email: '', phone: '', dni: '' })
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  // --- ESTADOS DE ESTADÍSTICAS ---
  const [stats, setStats] = useState(null)

  // --- 🔒 EFECTO DE SEGURIDAD AL INICIAR ---
  useEffect(() => {
    // Comprobamos si ya inició sesión antes en este navegador
    const isLogged = localStorage.getItem('gym_auth');
    if (isLogged === 'true') {
        setIsAuthenticated(true);
    }
  }, [])

  // --- 🔒 FUNCIÓN DE LOGIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
        localStorage.setItem('gym_auth', 'true'); // Guardamos que ya entró
        setIsAuthenticated(true);
    } else {
        alert("⛔ Contraseña incorrecta");
        setPasswordInput('');
    }
  }

  // --- 🔒 FUNCIÓN DE LOGOUT (Cerrar Sesión) ---
  const handleLogout = () => {
    localStorage.removeItem('gym_auth');
    setIsAuthenticated(false);
    setPasswordInput('');
  }

  // --- EFECTOS DE DATOS ---
  // Solo cargamos datos si está autenticado
  useEffect(() => {
    if (isAuthenticated) {
        fetchPlans()
        loadVisits()
    }
  }, [isAuthenticated]) // Se ejecuta cuando se loguea

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      if (query.length >= 2) searchData()
      else setResults([])
    }, 500)
    return () => clearTimeout(timer)
  }, [query, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentView === 'stats') loadStats()
    if (currentView === 'list') loadAllClients()
  }, [currentView, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentView === 'reception') {
        const interval = setInterval(() => {
            loadVisits();
        }, 5000); 
        return () => clearInterval(interval);
    }
  }, [currentView, isAuthenticated]);

  // --- FUNCIONES DE CARGA DE DATOS ---
  const fetchPlans = () => {
    fetch('https://api-gimnasio.onrender.com/api/plans') // <--- CAMBIA ESTO POR TU URL SI YA DESPLEGASTE
      .then(res => res.json())
      .then(data => setPlans(data))
      .catch(console.error)
  }

  const loadVisits = () => {
    const timestamp = new Date().getTime(); 
    fetch(`https://api-gimnasio.onrender.com/api/visits?t=${timestamp}`) // <--- CAMBIA URL
      .then(res => res.json())
      .then(data => setVisits(data))
      .catch(console.error)
  }

  const loadAllClients = () => {
    fetch('https://api-gimnasio.onrender.com/api/clients-all') // <--- CAMBIA URL
      .then(res => res.json())
      .then(data => setAllClients(data))
      .catch(console.error)
  }

  const loadStats = async () => {
    try {
        const res = await fetch('https://api-gimnasio.onrender.com/api/stats'); // <--- CAMBIA URL
        const data = await res.json();
        setStats(data);
    } catch (error) { console.error(error); }
  };

  const searchData = async () => {
    setLoading(true)
    try {
      const timestamp = new Date().getTime()
      const response = await fetch(`https://api-gimnasio.onrender.com/api/search?q=${query}&t=${timestamp}`) // <--- CAMBIA URL
      const data = await response.json()
      setResults(data)
    } catch (error) { console.error(error) } 
    finally { setLoading(false) }
  }

  // --- ACCIONES (POST/PUT/DELETE) ---
  // IMPORTANTE: Recuerda cambiar también las URLs aquí abajo a tu Render si despliegas
  // He puesto 'http://localhost:3001' por defecto para que te funcione AHORA en local.
  // Cuando despliegues, usa Ctrl+H para cambiar 'http://localhost:3001' por tu URL de Render.
  
  const BASE_URL = 'http://localhost:3001'; // <--- CAMBIA ESTO CUANDO TENGAS LA URL DE RENDER

  const handleCreateClient = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientForm)
      })
      if (response.ok) {
        alert('¡Cliente creado!')
        setShowClientModal(false)
        setClientForm({ first_name: '', last_name: '', email: '', phone: '' })
        setQuery(clientForm.first_name) 
      } else { alert('Error al crear') }
    } catch (error) { alert('Error de conexión') }
  }

  const handleUpdateClient = async (e) => {
    e.preventDefault()
    if (!editingClient) return
    try {
      const response = await fetch(`${BASE_URL}/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingClient)
      })
      if (response.ok) {
        alert('¡Datos actualizados correctamente!')
        setEditingClient(null)
        // Refrescamos según dónde estemos
        if (currentView === 'list') loadAllClients()
        else searchData()
      } else { alert('Error al guardar los cambios') }
    } catch (error) { alert('Error de conexión') }
  }

  const handleDeleteClient = async () => {
    if (!editingClient) return
    const confirmacion = window.confirm(`¿ESTÁS SEGURO?\n\nSe borrará a ${editingClient.first_name} y todo su historial.\n\nEsta acción no se puede deshacer.`);
    if (!confirmacion) return;

    try {
      const response = await fetch(`${BASE_URL}/api/clients/${editingClient.id}`, { method: 'DELETE' })
      if (response.ok) {
        alert('🗑️ Cliente eliminado.')
        setEditingClient(null)
        if (currentView === 'list') loadAllClients()
        else searchData()
      } else { alert('Error al eliminar') }
    } catch (error) { alert('Error de conexión') }
  }

  const handleCreateSubscription = async (e) => {
    e.preventDefault()
    if (!selectedPlanId) return alert("Elige un plan")
    try {
      const response = await fetch(`${BASE_URL}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedUser.id, plan_id: selectedPlanId })
      })
      if (response.ok) {
        alert(`¡Suscripción activada!`)
        setShowSubModal(false)
        setSelectedPlanId('')
        searchData() 
      } else { alert('Error al renovar') }
    } catch (error) { alert('Error de conexión') }
  }

  const handleCheckIn = async (userId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: userId })
      })
      const data = await response.json();
      if (response.ok) {
        alert("✅ " + data.message);
        loadVisits(); 
      } else {
        alert("⛔ " + data.error);
      }
    } catch (error) { alert("Error de conexión"); }
  }

  // --- UTILIDADES VISUALES ---
  const getStatusColor = (status) => {
    switch(status) { case 'ACTIVO': return '#dcfce7'; case 'INACTIVO': return '#f3f4f6'; default: return '#e0f2fe'; }
  }
  const getStatusTextColor = (status) => {
    switch(status) { case 'ACTIVO': return '#166534'; case 'INACTIVO': return '#374151'; default: return '#075985'; }
  }

  // --- 🔒 RENDERIZADO: PANTALLA DE BLOQUEO O APP ---
  if (!isAuthenticated) {
    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor: '#f3f4f6' 
        }}>
            <form onSubmit={handleLogin} style={{ 
                background: 'white', 
                padding: '40px', 
                borderRadius: '12px', 
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                textAlign: 'center',
                width: '300px'
            }}>
                <h2 style={{ marginBottom: '20px', color: '#333' }}>🔐 Acceso Gimnasio</h2>
                <input 
                    type="password" 
                    placeholder="Contraseña..." 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    style={{ 
                        width: '100%', padding: '12px', marginBottom: '20px', 
                        border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px' 
                    }}
                />
                <button 
                    type="submit" 
                    style={{ 
                        width: '100%', padding: '12px', background: '#2563eb', 
                        color: 'white', border: 'none', borderRadius: '6px', 
                        fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' 
                    }}
                >
                    Entrar
                </button>
            </form>
        </div>
    )
  }

  // --- APP PRINCIPAL (SOLO SI ESTÁ AUTENTICADO) ---
  return (
    <div className="main-container">
      
      {/* MENÚ */}
      <div className="nav-header">
          <h1 className="nav-title">🏋️ Gym Manager</h1>
          
          <div className="nav-buttons-group">
            <button 
              onClick={() => setCurrentView('reception')} 
              className="nav-btn"
              style={{ background: currentView === 'reception' ? '#111827' : '#e5e7eb', color: currentView === 'reception' ? 'white' : '#374151' }}
            >
              Recepción
            </button>
            
            <button 
              onClick={() => setCurrentView('list')} 
              className="nav-btn"
              style={{ background: currentView === 'list' ? '#111827' : '#e5e7eb', color: currentView === 'list' ? 'white' : '#374151' }}
            >
              Socios 📋
            </button>

            <button 
              onClick={() => setCurrentView('stats')} 
              className="nav-btn"
              style={{ background: currentView === 'stats' ? '#111827' : '#e5e7eb', color: currentView === 'stats' ? 'white' : '#374151' }}
            >
              Estadísticas 📊
            </button>
          </div>

          {/* Botón Salir */}
          <button onClick={handleLogout} style={{ marginLeft: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Cerrar Sesión">
            🔓
          </button>
      </div>

      {/* VISTA RECEPCIÓN */}
      {currentView === 'reception' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
           <div className="section-header">
              <h2>Control de Acceso</h2>
              <button onClick={() => setShowClientModal(true)} className="action-btn">+ Nuevo Socio</button>
           </div>
           
           <input 
              type="text" 
              placeholder="Buscar socio (Nombre)..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
           />

           <div className="results-list">
              {results.map((user) => (
                  <div key={user.id} className="user-card" style={{ borderLeft: `5px solid ${getStatusTextColor(user.status)}` }}>
                      <div className="card-info">
                          <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>{user.first_name} {user.last_name}</h3>
                          <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>
                              {user.first_name} {user.last_name} 
                              <span style={{fontSize:'0.8em', color:'#666', marginLeft:'10px'}}>
                                  ({user.dni || 'Sin DNI'})
                              </span>
                          </h3>
                          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                            {user.last_plan ? user.last_plan : 'Sin plan registrado'}
                            {user.last_expiration_date && ` - Vence: ${new Date(user.last_expiration_date).toLocaleDateString()}`}
                          </p>
                      </div>
                      <div className="card-actions">
                         <button 
                            onClick={() => handleCheckIn(user.id)} 
                            className="nav-btn" 
                            style={{ background: user.status === 'ACTIVO' ? '#16a34a' : '#9ca3af', color: 'white' }}
                         >
                            Entrada ➡️
                         </button>
                         
                         <div style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: getStatusColor(user.status), color: getStatusTextColor(user.status) }}>
                            {user.status}
                         </div>

                         <button 
                            onClick={() => {
                                const dateStr = user.last_expiration_date ? new Date(user.last_expiration_date).toISOString().split('T')[0] : '';
                                setEditingClient({ ...user, expiration_date: dateStr });
                            }} 
                            className="nav-btn" 
                            style={{ background: '#4b5563', color: 'white' }}
                        >
                            Datos ✏️
                        </button>

                         <button onClick={() => { setSelectedUser(user); setShowSubModal(true); }} className="nav-btn" style={{ background: '#2563eb', color: 'white' }}>Renovar</button>
                      </div>
                  </div>
              ))}
              {results.length === 0 && query.length > 2 && <p style={{color:'#666', textAlign:'center'}}>No se encontraron socios.</p>}
           </div>

           <div style={{ marginTop: '40px', borderTop: '2px solid #eee', paddingTop: '20px' }}>
                <h2>📋 Accesos (Últimas 24h)</h2>
                {visits.length === 0 ? (
                    <p style={{ color: '#888' }}>Nadie ha entrado recientemente.</p>
                ) : (
                    <table className="visits-table">
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th>Hora</th>
                                <th>Socio</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visits.map(v => (
                                <tr key={v.id}>
                                    <td>{new Date(v.visited_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                    <td style={{ fontWeight: 'bold' }}>{v.first_name} {v.last_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
           </div>
        </div>
      )}

      {/* VISTA LISTA COMPLETA */}
      {currentView === 'list' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
            <div className="section-header">
              <h2>Directorio de Socios ({allClients.length})</h2>
              <button onClick={() => setShowClientModal(true)} className="action-btn">+ Nuevo Socio</button>
            </div>

            <table className="visits-table" style={{ marginTop: '20px' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                        <th>Nombre</th>
                        <th>DNI</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {allClients.map(client => (
                        <tr key={client.id}>
                            <td style={{ fontWeight: 'bold' }}>{client.first_name} {client.last_name}</td>
                            <td style={{ color: '#666' }}>{client.dni || '-'}</td>
                            <td style={{ color: '#666' }}>{client.phone || '-'}</td>
                            <td>
                                <span style={{ padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: getStatusColor(client.status), color: getStatusTextColor(client.status) }}>
                                    {client.status}
                                </span>
                            </td>
                            <td>
                                <button 
                                    onClick={() => {
                                        const dateStr = client.last_expiration_date ? new Date(client.last_expiration_date).toISOString().split('T')[0] : '';
                                        setEditingClient({ ...client, expiration_date: dateStr });
                                    }} 
                                    style={{ padding: '5px 10px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    ✏️ Editar
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {/* VISTA ESTADÍSTICAS */}
      {currentView === 'stats' && stats && (
        <div style={{ animation: 'fadeIn 0.5s' }}>
            <div className="stats-kpi-container">
                <div className="kpi-card">
                    <h3 style={{ margin: 0, color: '#666' }}>Socios Totales</h3>
                    <p style={{ fontSize: '40px', fontWeight: 'bold', margin: '10px 0', color: '#2563eb' }}>{stats.totals.total_clients}</p>
                </div>
                <div className="kpi-card">
                    <h3 style={{ margin: 0, color: '#666' }}>Activos Ahora</h3>
                    <p style={{ fontSize: '40px', fontWeight: 'bold', margin: '10px 0', color: '#16a34a' }}>{stats.totals.active_clients}</p>
                </div>
            </div>

            <div className="chart-card">
                <h3 style={{ marginBottom: '20px', color: '#333' }}>📅 Visitas Diarias (30 días)</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.daily}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip contentStyle={{ color: '#333' }} />
                            <Line type="monotone" dataKey="visits" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 8 }} name="Visitas" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="chart-card">
                <h3 style={{ marginBottom: '20px', color: '#333' }}>📈 Evolución Mensual</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.monthly}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip contentStyle={{ color: '#333' }} />
                            <Bar dataKey="visits" fill="#82ca9d" name="Visitas" radius={[5, 5, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      )}

      {/* MODAL 1: CREAR CLIENTE */}
      {showClientModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nuevo Socio</h2>
            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input className="form-input" required placeholder="Nombre" value={clientForm.first_name} onChange={e => setClientForm({...clientForm, first_name: e.target.value})} />
              <input className="form-input" required placeholder="Apellidos" value={clientForm.last_name} onChange={e => setClientForm({...clientForm, last_name: e.target.value})} />
              <input className="form-input" type="email" placeholder="Email" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} />
              <input className="form-input" placeholder="Teléfono" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
              <input className="form-input" placeholder="DNI" value={clientForm.dni} onChange={e => setClientForm({...clientForm, dni: e.target.value})} />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="action-btn" style={{flex:1}}>Guardar</button>
                <button type="button" onClick={() => setShowClientModal(false)} className="nav-btn" style={{flex:1, background:'#ccc'}}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RENOVAR */}
      {showSubModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Renovar a {selectedUser.first_name}</h2>
            <p>Selecciona una tarifa:</p>
            <form onSubmit={handleCreateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <select className="form-input" required value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} style={{ backgroundColor: 'white' }}>
                <option value="">-- Elige un plan --</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name} - {plan.price}€ ({plan.duration_days} días)</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="action-btn" style={{flex:1}}>Confirmar Pago</button>
                <button type="button" onClick={() => setShowSubModal(false)} className="nav-btn" style={{flex:1, background:'#ccc'}}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR CLIENTE (DATOS) */}
      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>📝 Modificar Datos</h2>
            <form onSubmit={handleUpdateClient} className="form-group">
              
              <label style={{fontWeight:'bold', fontSize:'0.9rem'}}>Nombre:</label>
              <input className="form-input" value={editingClient.first_name} onChange={e => setEditingClient({...editingClient, first_name: e.target.value})} />
              
              <label style={{fontWeight:'bold', fontSize:'0.9rem'}}>Apellidos:</label>
              <input className="form-input" value={editingClient.last_name} onChange={e => setEditingClient({...editingClient, last_name: e.target.value})} />
              
              <label style={{fontWeight:'bold', fontSize:'0.9rem'}}>Email:</label>
              <input className="form-input" value={editingClient.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} />
              
              <label style={{fontWeight:'bold', fontSize:'0.9rem'}}>Teléfono:</label>
              <input className="form-input" value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} />

              <label style={{fontWeight:'bold', fontSize:'0.9rem', marginTop:'10px', display:'block', color:'#2563eb'}}>📅 Vencimiento (Modificar):</label>
              <input type="date" className="form-input" value={editingClient.expiration_date || ''} onChange={e => setEditingClient({...editingClient, expiration_date: e.target.value})} />
              <p style={{fontSize:'0.8rem', color:'#666', marginTop:'5px'}}>Cambiar esto alargará o acortará su suscripción actual.</p>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" className="action-btn" style={{flex:1}}>Guardar Cambios</button>
                <button type="button" onClick={() => setEditingClient(null)} className="nav-btn" style={{flex:1, background:'#ccc'}}>Cancelar</button>
              </div>
            </form>

            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                <button 
                    type="button" 
                    onClick={handleDeleteClient} 
                    style={{ width: '100%', padding: '10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    🗑️ Eliminar este Cliente
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App