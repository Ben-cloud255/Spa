import type {Room} from './types';
export interface OverviewData {
 updatedAt:string;date:string;rooms:Room[];
 totals:{collected:number;yesterdayCollected:number;bookings:number;completed:number;active:number;pending:number;free:number;onHold:number;overdue:number;outstanding:number;unpaid:number};
 days:{date:string;amount:number}[];
 branches:{id:number|null;name:string;rooms:number;active:number;pending:number;free:number;collected:number;completed:number}[];
 payments:{id:number;amount:number;created_at:string;branch_id:number;branch_name:string;customer_name:string;provider_name:string;receptionist_name:string}[];
 completed:{id:number;customer_name:string;ended_at:string;branch_name:string;provider_name:string;service_name:string}[];
 lowStock:{id:number;item:string;branch:string;quantity:number;minimum:number}[];
 notifications:{id:number;type:string;message:string;created_at:string}[];
}
