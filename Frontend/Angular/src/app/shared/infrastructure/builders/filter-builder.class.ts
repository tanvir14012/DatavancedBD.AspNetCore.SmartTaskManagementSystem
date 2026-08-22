import { FluentBuilder } from '../../core';
import { IFilterCondition, IFilterGroup, FilterLogic, FilterOperator } from '../../core';

/**
 * Filter builder for constructing filters
 */
export class FilterBuilder extends FluentBuilder<IFilterGroup> {
  private conditions: (IFilterCondition | IFilterGroup)[] = [];
  private logic: FilterLogic = FilterLogic.AND;

  withLogic(logic: FilterLogic): this {
    this.logic = logic;
    return this;
  }

  addCondition(field: string, operator: FilterOperator, value?: any): this {
    this.conditions.push({ field, operator, value });
    return this;
  }

  addGroup(group: IFilterGroup): this {
    this.conditions.push(group);
    return this;
  }

  build(): IFilterGroup {
    return { logic: this.logic, conditions: this.conditions };
  }
}
