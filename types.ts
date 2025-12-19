
export type PriorityLevel = 'normal' | 'aged' | 'wheelchair' | 'sick';

export interface Booking {
  passengerName: string;
  pickupStation: string;
  dropOffStation: string;
  ticketId: string;
  seatIndex: number;
  isWindow: boolean;
}

export interface SeatInfo {
  bookings: Booking[];
  isWindow: boolean;
}

export interface Passenger {
  id: string;
  name: string;
  priority: PriorityLevel;
  ticketId?: string;
}

export interface BusRecord {
  id: string;
  route: string;
  departureTime: string;
  status: 'Scheduled' | 'Departed' | 'Cancelled';
  capacity: number; 
  seats: SeatInfo[]; 
}

export interface RouteNode {
  id: string;
  name: string;
}

export interface RouteEdge {
  from: string;
  to: string;
  distance: number;
}

export type ActionType = 
  | { type: 'BOOK_TICKET'; busId: string; seatIndex: number; passengerName: string; pickup: string; dropOff: string }
  | { type: 'CANCEL_TICKET'; busId: string; seatIndex: number; passengerName: string }
  | { type: 'ENQUEUE_PASSENGER'; passenger: Passenger }
  | { type: 'DEQUEUE_PASSENGER'; passenger: Passenger };

export interface SystemAction {
  id: string;
  timestamp: Date;
  action: ActionType;
}
