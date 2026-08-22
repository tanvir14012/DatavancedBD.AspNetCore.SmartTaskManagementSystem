import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';

export interface PurchaseOrderDto {
  id: string;
  orderNumber: string;
  supplierName: string;
  supplierId: string;
  status: string;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate: string | null;
}

export interface InventoryItemDto {
  id: string;
  nameEn: string;
  code: string;
  unit: string;
  currentQuantity: number;
  reorderLevel: number;
  isBelowReorderLevel: boolean;
}

export interface TransactionDto {
  id: string;
  transactionNumber: string;
  transactionType: string;
  inventoryItemId: string;
  warehouseId: string;
  quantity: number;
  counterparty: string;
  date: string;
  remarks: string | null;
}

export interface RepairOrderDto {
  id: string;
  orderNumber: string;
  description: string;
  status: string;
  reportedDate: string;
  completedDate: string | null;
}

export interface VehicleSafetyRecordDto {
  id: string;
  vehicleRegistrationNumber: string;
  vehicleId: string;
  status: string;
  inspectionDate: string;
  nextInspectionDate: string | null;
  remarks: string | null;
}

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly api = inject(ApiService);

  getPurchaseOrders(): Observable<PurchaseOrderDto[]> {
    return this.api.get<PurchaseOrderDto[]>('procurement/purchase-orders');
  }

  getInventoryItems(): Observable<InventoryItemDto[]> {
    return this.api.get<InventoryItemDto[]>('storehouse/inventory-items');
  }

  getTransactions(): Observable<TransactionDto[]> {
    return this.api.get<TransactionDto[]>('issuereceipt/transactions');
  }

  getRepairOrders(): Observable<RepairOrderDto[]> {
    return this.api.get<RepairOrderDto[]>('repairmaintenance/repair-orders');
  }

  getVehicleSafetyRecords(): Observable<VehicleSafetyRecordDto[]> {
    return this.api.get<VehicleSafetyRecordDto[]>('trafficsecurity/vehicle-safety-records');
  }
}
