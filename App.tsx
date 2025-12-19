
import React, { useState, useCallback, useMemo } from 'react';
import { 
  BusFront, 
  Users, 
  Map as MapIcon, 
  Ticket, 
  History, 
  LayoutDashboard,
  Plus,
  Trash2,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Search,
  ExternalLink,
  ArrowRight,
  LogOut,
  X,
  CheckCircle2,
  MapPin,
  User as UserIcon,
  Accessibility,
  HeartPulse,
  UserPlus,
  Zap,
  UserCheck,
  ShieldCheck,
  ArrowRightLeft,
  QrCode,
  Info,
  Clock,
  ArrowUpRight,
  UserCircle
} from 'lucide-react';
import { Graph } from './services/dsaLogic';
import { Passenger, BusRecord, SystemAction, ActionType, SeatInfo, PriorityLevel, Booking } from './types';

const STATIONS = ['Peshawar Morr', 'British Homes', 'I/10 Stop', 'I-9', 'I-8', 'Faizabad'];

const createEmptySeats = (capacity: number): SeatInfo[] => 
  new Array(capacity).fill(null).map((_, i) => {
    // In a 4-column bus layout:
    // Indices 0, 4, 8... and 3, 7, 11... are windows
    const col = i % 4;
    return { 
      bookings: [], 
      isWindow: col === 0 || col === 3 
    };
  });

const INITIAL_BUSES: BusRecord[] = [
  { id: 'BUS-101', route: 'Peshawar Morr - Faizabad', departureTime: '08:00 AM', status: 'Scheduled', capacity: 20, seats: createEmptySeats(20) },
  { id: 'BUS-102', route: 'I/10 Express Hub', departureTime: '09:30 AM', status: 'Scheduled', capacity: 24, seats: createEmptySeats(24) },
  { id: 'BUS-103', route: 'City Loop Internal', departureTime: '11:00 AM', status: 'Scheduled', capacity: 16, seats: createEmptySeats(16) },
];

const rangesOverlap = (s1: string, e1: string, s2: string, e2: string) => {
  const iS1 = STATIONS.indexOf(s1);
  const iE1 = STATIONS.indexOf(e1);
  const iS2 = STATIONS.indexOf(s2);
  const iE2 = STATIONS.indexOf(e2);
  return Math.max(iS1, iS2) < Math.min(iE1, iE2);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'schedule' | 'booking' | 'history'>('dashboard');

  // DSA State
  const [passengerQueue, setPassengerQueue] = useState<Passenger[]>([]);
  const [busList, setBusList] = useState<BusRecord[]>(INITIAL_BUSES);
  const [undoStack, setUndoStack] = useState<SystemAction[]>([]);
  const [redoStack, setRedoStack] = useState<SystemAction[]>([]);
  
  // Ticketing Segment State
  const [filterPickup, setFilterPickup] = useState(STATIONS[0]);
  const [filterDropoff, setFilterDropoff] = useState(STATIONS[STATIONS.length - 1]);

  // UI State
  const [pName, setPName] = useState('');
  const [pPriority, setPPriority] = useState<PriorityLevel>('normal');
  const [directAlloc, setDirectAlloc] = useState(false);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [selectedSeatIndices, setSelectedSeatIndices] = useState<number[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [passengerDetails, setPassengerDetails] = useState<{ [key: number]: { name: string, pickup: string, dropOff: string } }>({});
  const [showTickets, setShowTickets] = useState<(Booking & { busId: string })[] | null>(null);

  const handleEnqueue = () => {
    if (!pName) return;
    
    if (directAlloc) {
      // Direct Booking flow
      setBookingBusId(null);
      setSelectedSeatIndices([]);
      setActiveTab('booking');
      return;
    }

    const newPassenger: Passenger = { 
      id: `P${Date.now()}`, 
      name: pName, 
      priority: pPriority 
    };

    setPassengerQueue(prev => {
      if (newPassenger.priority === 'normal') {
        return [...prev, newPassenger];
      } else {
        const firstNormalIndex = prev.findIndex(p => p.priority === 'normal');
        if (firstNormalIndex === -1) {
          return [...prev, newPassenger];
        }
        const updated = [...prev];
        updated.splice(firstNormalIndex, 0, newPassenger);
        return updated;
      }
    });
    
    recordAction({ type: 'ENQUEUE_PASSENGER', passenger: newPassenger });
    setPName('');
    setPPriority('normal');
  };

  const handleBoarding = (targetId?: string) => {
    if (passengerQueue.length === 0) return;
    const p = targetId ? passengerQueue.find(item => item.id === targetId) : passengerQueue[0];
    if (!p) return;
    
    // Auto fill for next booking
    setPName(p.name);
    setPPriority(p.priority);
    setDirectAlloc(true);
    setBookingBusId(null);
    setSelectedSeatIndices([]);
    setActiveTab('booking');
  };

  const recordAction = (action: ActionType) => {
    const systemAction: SystemAction = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      action
    };
    setUndoStack(prev => [...prev, systemAction]);
    setRedoStack([]); 
  };

  const undoLastAction = useCallback(() => {
    if (undoStack.length === 0) return;
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack]);

  const handleSeatSelect = (busId: string, idx: number) => {
    const bus = busList.find(b => b.id === busId);
    if (!bus) return;

    const isOccupiedInRange = bus.seats[idx].bookings.some(b => 
      rangesOverlap(b.pickupStation, b.dropOffStation, filterPickup, filterDropoff)
    );

    if (isOccupiedInRange) return;

    if (bookingBusId !== null && bookingBusId !== busId) {
      setSelectedSeatIndices([idx]);
      setBookingBusId(busId);
    } else {
      setBookingBusId(busId);
      setSelectedSeatIndices(prev => 
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      );
    }
  };

  const startBooking = () => {
    if (selectedSeatIndices.length === 0) return;
    const initialDetails = selectedSeatIndices.reduce((acc, idx, i) => {
      acc[idx] = { 
        name: i === 0 && pName ? pName : "", 
        pickup: filterPickup, 
        dropOff: filterDropoff 
      };
      return acc;
    }, {} as any);
    setPassengerDetails(initialDetails);
    setShowBookingModal(true);
  };

  const finalizeBooking = () => {
    if (!bookingBusId) return;
    const newTickets: (Booking & { busId: string })[] = [];
    
    setBusList(prev => prev.map(bus => {
      if (bus.id !== bookingBusId) return bus;
      const updatedSeats = [...bus.seats];
      selectedSeatIndices.forEach(idx => {
        const detail = passengerDetails[idx];
        const ticket: Booking = {
          passengerName: detail.name || "Unknown Passenger",
          pickupStation: detail.pickup,
          dropOffStation: detail.dropOff,
          ticketId: `METRO-${Math.floor(Math.random() * 90000) + 10000}`,
          seatIndex: idx + 1,
          isWindow: bus.seats[idx].isWindow
        };
        updatedSeats[idx] = {
          ...updatedSeats[idx],
          bookings: [...updatedSeats[idx].bookings, ticket]
        };
        newTickets.push({ ...ticket, busId: bookingBusId });
        recordAction({ 
          type: 'BOOK_TICKET', 
          busId: bookingBusId, 
          seatIndex: idx, 
          passengerName: detail.name || "Unknown Passenger",
          pickup: detail.pickup,
          dropOff: detail.dropOff
        });
      });
      return { ...bus, seats: updatedSeats };
    }));
    
    const namesToRemove = Object.values(passengerDetails).map(d => d.name);
    setPassengerQueue(prev => prev.filter(p => !namesToRemove.includes(p.name)));

    setShowTickets(newTickets);
    setShowBookingModal(false);
    setSelectedSeatIndices([]);
    setPassengerDetails({});
    setPName('');
    setDirectAlloc(false);
  };

  const getOccupancyCount = (bus: BusRecord) => {
    return bus.seats.filter(s => 
      s.bookings.some(b => rangesOverlap(b.pickupStation, b.dropOffStation, filterPickup, filterDropoff))
    ).length;
  };

  const renderActionDetails = (action: ActionType) => {
    switch (action.type) {
      case 'BOOK_TICKET':
        return (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Passenger</p>
              <p className="font-bold text-slate-800 text-sm truncate">{action.passengerName}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Transport</p>
              <p className="font-bold text-blue-600 text-sm">Bus {action.busId}</p>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Position</p>
              <p className="font-bold text-slate-800 text-sm">Seat #{action.seatIndex + 1}</p>
            </div>
            <div className="col-span-full p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Journey Segment</p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="px-2 py-0.5 bg-slate-50 rounded border border-slate-100">{action.pickup}</span>
                  <ArrowRight size={14} className="text-blue-400" />
                  <span className="px-2 py-0.5 bg-slate-50 rounded border border-slate-100">{action.dropOff}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <ShieldCheck size={20} />
              </div>
            </div>
          </div>
        );
      case 'ENQUEUE_PASSENGER':
        return (
          <div className="mt-4 flex gap-4">
             <div className="flex-1 p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <UserCircle size={24} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Added to Buffer</p>
                   <p className="font-bold text-slate-900">{action.passenger.name}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                   <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase">{action.passenger.priority}</span>
                   {action.passenger.priority !== 'normal' && <Zap size={14} className="text-amber-500 fill-amber-500" />}
                </div>
             </div>
          </div>
        );
      case 'DEQUEUE_PASSENGER':
        return (
          <div className="mt-4 p-4 bg-slate-900 text-white rounded-xl flex items-center gap-4">
             <ArrowUpRight size={20} className="text-blue-400" />
             <p className="text-sm font-bold">Transferring <span className="text-blue-400">{action.passenger.name}</span> to active boarding gates.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 shadow-2xl z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <BusFront className="text-blue-400" size={32} strokeWidth={2.5} />
            <h1 className="text-2xl font-black tracking-tighter text-nowrap">MetroBSMS</h1>
          </div>
          <p className="text-[10px] text-blue-400 uppercase tracking-[0.2em] font-black">Intelligent Logistics</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Overview" />
          <NavItem active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={<Users size={20} />} label="Boarding Queue" />
          <NavItem active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<BusFront size={20} />} label="Fleet Schedule" />
          <NavItem active={activeTab === 'booking'} onClick={() => setActiveTab('booking')} icon={<Ticket size={20} />} label="Ticketing System" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="System Log" />
        </nav>

        <div className="p-6 bg-slate-950/40 border-t border-slate-800">
          <button onClick={undoLastAction} disabled={undoStack.length === 0} className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-20 transition-all border border-slate-700 flex justify-center shadow-lg"><RotateCcw size={18} /></button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-10 bg-white relative">
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-start">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Station Control Room</h2>
                <p className="text-slate-500 mt-1 text-lg">Real-time Segment Tracking</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Waiting List" value={passengerQueue.length} icon={<Users />} color="blue" onClick={() => setActiveTab('queue')} />
              <StatCard label="Live Buses" value={busList.length} icon={<BusFront />} color="emerald" onClick={() => setActiveTab('schedule')} />
              <StatCard label="Vacant Segments" value={busList.reduce((acc, b) => acc + (b.capacity - getOccupancyCount(b)), 0)} icon={<Ticket />} color="orange" onClick={() => setActiveTab('booking')} />
              <StatCard label="Total Ops" value={undoStack.length} icon={<History />} color="purple" onClick={() => setActiveTab('history')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col min-h-[350px]">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3"><Zap size={24} className="text-yellow-400" /> Fast Intake (Next in Queue)</h3>
                {passengerQueue[0] ? (
                   <div className="space-y-8 flex-1">
                     <div className="p-8 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
                        <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black mb-2">Direct Boarding Available</p>
                        <h4 className="text-3xl font-black tracking-tight truncate">{passengerQueue[0].name}</h4>
                        <div className="flex gap-4 mt-4">
                           <span className="text-[10px] font-black px-3 py-1.5 rounded-xl uppercase bg-yellow-500/20 text-yellow-300">{passengerQueue[0].priority}</span>
                           <span className="text-[10px] font-black px-3 py-1.5 rounded-xl uppercase bg-blue-500/20 text-blue-300">Wait: #{passengerQueue.length}</span>
                        </div>
                     </div>
                     <button onClick={() => handleBoarding()} className="w-full py-5 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-3 group">Process Fast Intake <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" /></button>
                   </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <UserCheck size={40} className="text-slate-600" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Intake Queue Clear</p>
                    <button onClick={() => setActiveTab('queue')} className="mt-6 px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Go to Queue Tab</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
             <header className="border-b border-slate-100 pb-8">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Intake Management</h2>
              <p className="text-slate-500 mt-2 text-lg italic">Process passengers directly or add to station queue.</p>
            </header>

            <div className="bg-slate-50 rounded-[3rem] p-12 border border-slate-100 shadow-sm">
              <div className="space-y-8 mb-12">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                    <input 
                      type="text" 
                      placeholder="Passenger Name..." 
                      className="w-full pl-14 pr-8 py-5 bg-white border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-500/10 outline-none text-xl font-bold transition-all shadow-inner"
                      value={pName}
                      onChange={e => setPName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEnqueue()}
                    />
                  </div>
                  <button onClick={handleEnqueue} className="px-10 bg-blue-600 text-white rounded-3xl hover:bg-blue-700 transition-all flex items-center gap-3 font-black uppercase tracking-widest text-sm shadow-xl">
                    {directAlloc ? <Zap size={22} /> : <Plus size={22} />} {directAlloc ? 'Fast Booking' : 'Add to Queue'}
                  </button>
                </div>

                <div className="flex items-center gap-6 p-6 bg-white rounded-3xl border border-slate-200">
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Process Mode</span>
                    <div className="flex gap-2">
                       <button onClick={() => setDirectAlloc(false)} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${!directAlloc ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Normal Queue</button>
                       <button onClick={() => setDirectAlloc(true)} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${directAlloc ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Direct Booking</button>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-slate-200" />
                  <div className="flex flex-wrap gap-2 flex-[2]">
                    <PriorityButton label="Normal" value="normal" active={pPriority === 'normal'} onClick={() => setPPriority('normal')} icon={<Users size={16} />} />
                    <PriorityButton label="Aged" value="aged" active={pPriority === 'aged'} onClick={() => setPPriority('aged')} icon={<UserPlus size={16} />} />
                    <PriorityButton label="Med" value="sick" active={pPriority === 'sick'} onClick={() => setPPriority('sick')} icon={<HeartPulse size={16} />} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2 px-2"><History size={16} /> Current Station Queue</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {passengerQueue.map((p, i) => (
                    <div key={p.id} className={`p-6 rounded-3xl border transition-all flex items-center justify-between ${i === 0 ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-slate-600'}`}>
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${i === 0 ? 'bg-blue-600' : 'bg-slate-100'}`}>{i + 1}</span>
                        <div>
                          <p className="font-black truncate max-w-[150px]">{p.name}</p>
                          <p className={`text-[9px] font-black uppercase ${i === 0 ? 'text-blue-400' : 'text-slate-400'}`}>{p.priority}</p>
                        </div>
                      </div>
                      <button onClick={() => handleBoarding(p.id)} className={`p-3 rounded-xl transition-all ${i === 0 ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-slate-100'}`} title="Move to Direct Booking"><ChevronRight size={20} /></button>
                    </div>
                  ))}
                  {passengerQueue.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem]">
                      <Users size={32} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Queue is Empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <header className="border-b border-slate-100 pb-8">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Fleet Schedule</h2>
              <p className="text-slate-500 mt-2 text-lg italic">Real-time status of all active metropolitan buses.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {busList.map(bus => (
                <div key={bus.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm hover:shadow-2xl transition-all cursor-pointer group" onClick={() => { setBookingBusId(bus.id); setActiveTab('booking'); }}>
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                      <BusFront size={32} />
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">{bus.status}</p>
                       <p className="text-xl font-black text-slate-900 mt-2">{bus.departureTime}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">{bus.id}</h3>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{bus.route}</p>
                    </div>

                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>Segment Occupancy</span>
                          <span>{getOccupancyCount(bus)} / {bus.capacity}</span>
                       </div>
                       <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all duration-1000" 
                            style={{ width: `${(getOccupancyCount(bus) / bus.capacity) * 100}%` }} 
                          />
                       </div>
                    </div>

                    <button className="w-full py-4 bg-slate-50 text-slate-900 font-black rounded-2xl border border-slate-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-700 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3">
                      View Seating <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'booking' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <header className="border-b border-slate-100 pb-10">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Segment Ticketing</h2>
              <p className="text-slate-500 mt-2 text-lg italic">Reservations mapped using <b>Segment-Based 2D Arrays</b>.</p>
              
              <div className="mt-8 p-6 bg-blue-50 border border-blue-100 rounded-[2rem] flex flex-wrap items-center gap-8 shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Origin Station</label>
                      <select className="bg-white border border-blue-200 px-6 py-3 rounded-2xl font-bold outline-none cursor-pointer" value={filterPickup} onChange={(e) => setFilterPickup(e.target.value)}>
                        {STATIONS.slice(0, -1).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <ArrowRightLeft className="text-blue-300 mt-4" size={20} />
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Destination Station</label>
                      <select className="bg-white border border-blue-200 px-6 py-3 rounded-2xl font-bold outline-none cursor-pointer" value={filterDropoff} onChange={(e) => setFilterDropoff(e.target.value)}>
                        {STATIONS.slice(STATIONS.indexOf(filterPickup) + 1).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                 </div>
                 {pName && (
                   <div className="ml-auto flex items-center gap-4 bg-white px-8 py-5 rounded-3xl border-2 border-amber-400 shadow-xl animate-pulse">
                     <Zap className="text-amber-500 fill-amber-500" size={20} />
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Intake Booking For</p>
                        <p className="text-sm font-black text-slate-900">{pName}</p>
                     </div>
                   </div>
                 )}
              </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 pb-32">
               {busList.map(bus => (
                 <div key={bus.id} className="bg-slate-50 rounded-[3rem] p-10 border border-slate-100 hover:shadow-2xl transition-all relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-8 relative z-10">
                      <div>
                        <div className="flex items-center gap-3">
                           <BusFront size={20} className="text-blue-600" />
                           <h3 className="font-black text-2xl text-slate-900">{bus.id}</h3>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{bus.route}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-black text-blue-600 tracking-tighter">{bus.capacity - getOccupancyCount(bus)} Vacant</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 bg-white p-8 rounded-[2.5rem] shadow-inner border border-slate-200/50 relative z-10">
                      {bus.seats.map((seat, idx) => {
                        const isSelected = selectedSeatIndices.includes(idx) && bookingBusId === bus.id;
                        const activeBooking = seat.bookings.find(b => rangesOverlap(b.pickupStation, b.dropOffStation, filterPickup, filterDropoff));
                        const isOccupied = !!activeBooking;

                        return (
                          <button
                            key={idx}
                            onClick={() => handleSeatSelect(bus.id, idx)}
                            className={`
                              aspect-square rounded-[1.5rem] flex flex-col items-center justify-center transition-all relative
                              ${isOccupied 
                                ? 'bg-blue-600 text-white cursor-not-allowed' 
                                : isSelected
                                  ? 'bg-amber-400 text-slate-900 scale-110 shadow-2xl z-20 border-2 border-amber-600'
                                  : 'bg-slate-50 text-slate-300 hover:border-blue-500 hover:bg-white hover:text-blue-500 border-2 border-transparent'}
                            `}
                          >
                            <span className="text-[7px] font-black uppercase opacity-60 mb-1">{seat.isWindow ? 'Window' : 'Aisle'}</span>
                            <Ticket size={24} className={isOccupied || isSelected ? 'opacity-100' : 'opacity-20'} />
                            <span className="text-[9px] font-black mt-1">#{idx + 1}</span>
                            {isOccupied && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                 </div>
               ))}
            </div>

            {selectedSeatIndices.length > 0 && (
              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-12 py-8 rounded-[2.5rem] shadow-2xl flex items-center gap-10 z-50 animate-in slide-in-from-bottom-10">
                <div>
                   <p className="text-2xl font-black tracking-tight">{selectedSeatIndices.length} Seat(s) Selected</p>
                   <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">{bookingBusId} | {filterPickup} to {filterDropoff}</p>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setSelectedSeatIndices([])} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Discard</button>
                   <button onClick={startBooking} className="px-12 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/30">Continue to Booking</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
             <header className="border-b border-slate-100 pb-8 flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">System Logs</h2>
                <p className="text-slate-500 mt-2 text-lg italic">Detailed audit trail for station operations.</p>
              </div>
              <div className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                 <Clock size={12} /> Live Sequence
              </div>
            </header>
            <div className="space-y-6 pb-20">
               {undoStack.length > 0 ? [...undoStack].reverse().map(action => (
                 <div key={action.id} className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 flex gap-2">
                       <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">Sequence ID: {action.id}</span>
                    </div>
                    <div className="flex items-start gap-6">
                       <div className={`p-4 rounded-2xl ${
                         action.action.type === 'BOOK_TICKET' ? 'bg-emerald-100 text-emerald-600' : 
                         action.action.type === 'ENQUEUE_PASSENGER' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                       }`}>
                         {action.action.type === 'BOOK_TICKET' ? <Ticket size={24} /> : 
                          action.action.type === 'ENQUEUE_PASSENGER' ? <Plus size={24} /> : <History size={24} />}
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{action.action.type.replace('_', ' ')}</h4>
                            <span className="text-[10px] font-bold text-slate-400">{action.timestamp.toLocaleTimeString()}</span>
                          </div>
                          {renderActionDetails(action.action)}
                       </div>
                    </div>
                 </div>
               )) : (
                 <div className="py-32 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                    <History size={48} className="mx-auto text-slate-200 mb-6" />
                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Transaction stack empty</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* --- MODALS --- */}
        {showBookingModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Confirm Seat Details</h3>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Assigning to {bookingBusId}</p>
                </div>
                <button onClick={() => setShowBookingModal(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {selectedSeatIndices.map((idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                       <h4 className="font-black text-slate-900">Seat #{idx + 1} ({busList.find(b => b.id === bookingBusId)?.seats[idx].isWindow ? 'Window' : 'Aisle'})</h4>
                       <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase">Pending Allocation</span>
                    </div>
                    <div className="space-y-4">
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          type="text" 
                          placeholder="Passenger Name..."
                          className="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold focus:ring-4 focus:ring-blue-500/10"
                          value={passengerDetails[idx]?.name || ""}
                          onChange={(e) => setPassengerDetails(prev => ({ ...prev, [idx]: { ...prev[idx], name: e.target.value } }))}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100"><MapPin size={10} /> {filterPickup}</div>
                        <ArrowRight size={14} className="text-blue-300" />
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100"><MapPin size={10} /> {filterDropoff}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                 <button onClick={finalizeBooking} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">Finalize Reservation</button>
              </div>
            </div>
          </div>
        )}

        {showTickets && (
          <div className="fixed inset-0 bg-slate-950/95 z-[70] p-10 overflow-y-auto flex flex-col items-center backdrop-blur-xl animate-in fade-in duration-500">
            <button onClick={() => setShowTickets(null)} className="absolute top-10 right-10 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"><X size={32} /></button>
            <div className="text-center text-white mb-12">
              <CheckCircle2 size={56} className="mx-auto mb-4 text-emerald-400" />
              <h3 className="text-4xl font-black tracking-tight mb-2">Tickets Issued</h3>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-sm">Station Authority Digital Pass</p>
            </div>
            
            <div className="flex flex-col gap-10 items-center max-w-7xl">
              {showTickets.map((t, i) => (
                <div key={i} className="flex h-72 w-[700px] animate-in slide-in-from-bottom-20" style={{ animationDelay: `${i * 150}ms` }}>
                  {/* Ticket Body */}
                  <div className="flex-1 bg-white rounded-l-[2.5rem] p-12 flex flex-col relative overflow-hidden border-r border-slate-100 shadow-2xl">
                    <div className="absolute top-0 right-0 w-10 h-10 bg-slate-950 rounded-bl-full translate-x-5 -translate-y-5" />
                    <div className="absolute bottom-0 right-0 w-10 h-10 bg-slate-950 rounded-tl-full translate-x-5 translate-y-5" />
                    
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <BusFront size={24} />
                         </div>
                         <div className="flex flex-col">
                            <span className="font-black text-sm text-slate-900 tracking-tighter">METRO TRANSIT</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Boarding Pass #{t.busId}</span>
                         </div>
                      </div>
                      <span className="text-[10px] font-black px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full">SEGMENT: VERIFIED</span>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                       <p className="text-[9px] font-black uppercase text-slate-300 mb-1 tracking-widest">Main Passenger</p>
                       <h4 className="text-3xl font-black text-slate-900 mb-8 truncate tracking-tight">{t.passengerName}</h4>
                       
                       <div className="grid grid-cols-2 gap-12">
                         <div className="relative">
                            <p className="text-[9px] font-black uppercase text-slate-300 mb-1 tracking-widest">Origin</p>
                            <p className="font-bold text-base text-slate-800 flex items-center gap-2"><MapPin size={12} className="text-blue-500" /> {t.pickupStation}</p>
                            <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                               <ArrowRight size={16} className="text-slate-200" />
                            </div>
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-slate-300 mb-1 tracking-widest">Destination</p>
                            <p className="font-bold text-base text-slate-800 flex items-center gap-2"><MapPin size={12} className="text-emerald-500" /> {t.dropOffStation}</p>
                         </div>
                       </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                       <div className="flex gap-6">
                          <div>
                             <p className="text-[8px] font-black text-slate-300 uppercase">Bus Number</p>
                             <p className="text-xs font-black text-slate-600">{t.busId}</p>
                          </div>
                          <div>
                             <p className="text-[8px] font-black text-slate-300 uppercase">Issue ID</p>
                             <p className="text-xs font-black text-slate-600">{t.ticketId.split('-')[1]}</p>
                          </div>
                       </div>
                       <QrCode size={24} className="text-slate-200" />
                    </div>
                  </div>

                  {/* Perforation Line */}
                  <div className="w-1.5 border-r-4 border-dotted border-slate-100 bg-white" />

                  {/* Ticket Stub */}
                  <div className="w-60 bg-white rounded-r-[2.5rem] p-12 flex flex-col items-center justify-between border-l border-slate-50 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-10 h-10 bg-slate-950 rounded-br-full -translate-x-5 -translate-y-5" />
                    <div className="absolute bottom-0 left-0 w-10 h-10 bg-slate-950 rounded-tr-full -translate-x-5 translate-y-5" />
                    
                    <div className="text-center">
                       <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.2em]">Assigned Seat</p>
                       <p className="text-6xl font-black text-blue-600 tracking-tighter mb-4">{t.seatIndex}</p>
                       <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${t.isWindow ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white'}`}>
                          {t.isWindow ? 'WINDOW SEAT' : 'AISLE SEAT'}
                       </div>
                    </div>

                    <div className="w-full">
                       <div className="flex justify-between items-center text-[8px] font-black text-slate-400 mb-2 uppercase tracking-widest">
                          <span>Security Hash</span>
                          <span>ST-V2</span>
                       </div>
                       <div className="w-full h-12 bg-slate-100 rounded-md p-1 flex items-end gap-[2px]">
                         {Array.from({length: 25}).map((_, j) => (
                           <div key={j} className="flex-1 bg-slate-900 rounded-sm" style={{ height: `${20 + Math.random() * 80}%` }} />
                         ))}
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button onClick={() => setShowTickets(null)} className="mt-16 px-20 py-6 bg-white text-slate-900 rounded-full font-black uppercase tracking-widest text-sm shadow-2xl hover:bg-slate-100 transition-all flex items-center gap-4">
              <CheckCircle2 size={20} className="text-emerald-500" /> Confirm & Ready
            </button>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// Helper Components
function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold group relative overflow-hidden ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 translate-x-2' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}>
      <span className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>{icon}</span>
      <span className="tracking-tight text-nowrap">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-md animate-pulse" />}
    </button>
  );
}

function PriorityButton({ label, value, active, onClick, icon }: { label: string, value: PriorityLevel, active: boolean, onClick: () => void, icon: React.ReactNode }) {
  const getColors = () => {
    if (!active) return 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:bg-slate-50';
    switch (value) {
      case 'normal': return 'bg-blue-600 text-white border-blue-700 shadow-md';
      case 'aged': return 'bg-orange-500 text-white border-orange-600 shadow-md';
      case 'sick': return 'bg-red-500 text-white border-red-600 shadow-md';
      default: return 'bg-blue-600 text-white border-blue-700';
    }
  };
  return (
    <button onClick={onClick} className={`px-5 py-3 rounded-2xl border transition-all flex items-center gap-3 font-black text-[10px] uppercase tracking-widest ${getColors()}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ label, value, icon, color, onClick }: { label: string, value: string | number, icon: React.ReactElement, color: string, onClick?: () => void }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-600 group-hover:text-white',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 group-hover:bg-purple-600 group-hover:text-white',
  };
  return (
    <div onClick={onClick} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:-translate-y-2 hover:shadow-2xl cursor-pointer group">
      <div className={`p-5 rounded-2xl border transition-all duration-300 ${colors[color]}`}>{React.cloneElement(icon, { size: 32 } as any)}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-nowrap">{label}</p>
        <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight text-nowrap">{value}</p>
      </div>
    </div>
  );
}
