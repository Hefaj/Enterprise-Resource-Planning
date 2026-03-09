import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { EInputTextBuilder, EInputTextComponent, ETwoSectionLayoutComponent } from '@erp/shared/ui';
import { EButtonBuilder, EButtonComponent, EButtonSave } from '@erp/shared-ui';
import { timeInterval } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CheckboxModule,
    InputTextModule,
    EButtonComponent,
    EInputTextComponent,
    ETwoSectionLayoutComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  public myDynamicForm = new FormGroup({
    email: new FormControl('jan@example.com', [Validators.required, Validators.email]),
    age: new FormControl(null, [Validators.required, Validators.minLength(5)]),
  });

  public isLoading = signal(false);

  public control = this.myDynamicForm.controls.email;

  public textConfig = EInputTextBuilder.create((input) => {
    input.setPlaceholser('Rafi');
    input.setErrorMessages({
      required: 'required',
      email: 'email',
    });
  });

  public control2 = this.myDynamicForm.controls.age;

  public textConfig2 = EInputTextBuilder.create((input) => {
    input.setPlaceholser('Rafi2');
    input.setHint('Ale jazda2');
    input.setErrorMessages({
      required: 'required',
      min: 'min',
    });
  });

  public saveBtn = EButtonBuilder.create(EButtonSave);

  public save(): void {
    if (this.myDynamicForm.invalid) {
      this.myDynamicForm.markAllAsDirty();
      return;
    }
    const formData = this.myDynamicForm.value;
    this.myDynamicForm.disable();
    this.isLoading.set(true);
    setTimeout(() => {
      this.myDynamicForm.reset();
      console.log(formData);
      this.myDynamicForm.enable();
      this.isLoading.set(false);
    }, 1000);
  }
}
