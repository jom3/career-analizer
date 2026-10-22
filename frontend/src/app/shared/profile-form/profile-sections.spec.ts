import { TestBed } from '@angular/core/testing';
import { FormArray } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  newExperienceForm,
  newSkillForm,
  type ExperienceForm,
  type SkillForm,
} from '../../core/profile-form';
import { ExperienceSectionComponent } from './experience-section.component';
import { SkillsSectionComponent } from './skills-section.component';

describe('SkillsSectionComponent', () => {
  let skills: FormArray<SkillForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    skills = new FormArray<SkillForm>([newSkillForm()]);
  });

  it('agrega y quita ítems sobre el FormArray recibido', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    fixture.componentInstance.add();
    expect(skills.length).toBe(2);

    fixture.componentInstance.remove(0);
    expect(skills.length).toBe(1);
  });

  it('marca el ítem duplicado según el índice recibido', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    fixture.componentRef.setInput('duplicateIndices', new Set([0]));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tag--duplicate')).not.toBeNull();
  });

  it('no muestra el tag de duplicado sin índices marcados', async () => {
    const fixture = TestBed.createComponent(SkillsSectionComponent);
    fixture.componentRef.setInput('skills', skills);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tag--duplicate')).toBeNull();
  });
});

describe('ExperienceSectionComponent', () => {
  let experiences: FormArray<ExperienceForm>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    experiences = new FormArray<ExperienceForm>([newExperienceForm()]);
  });

  it('oculta el editor de métricas con showMetrics en false', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    fixture.componentRef.setInput('showMetrics', false);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.metrics-editor')).toBeNull();
    expect(element.querySelector('[formcontrolname="company"]')).not.toBeNull();
  });

  it('muestra el editor de métricas por defecto y permite agregar', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.metrics-editor')).not.toBeNull();

    fixture.componentInstance.addMetric(experiences.controls[0]);
    expect(experiences.controls[0].controls.metrics.length).toBe(1);
  });

  it('marca solapamiento y duplicado por índice', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    fixture.componentRef.setInput('duplicateIndices', new Set([0]));
    fixture.componentRef.setInput('overlapIndices', new Set([0]));
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.tag--duplicate').length).toBe(2);
  });

  it('deshabilita la fecha de fin al marcar el puesto como actual', async () => {
    const fixture = TestBed.createComponent(ExperienceSectionComponent);
    fixture.componentRef.setInput('experiences', experiences);
    await fixture.whenStable();

    const group = experiences.controls[0];
    const event = { target: { checked: true } } as unknown as Event;

    fixture.componentInstance.onCurrentChange(group, event);
    expect(group.controls.endDate.disabled).toBe(true);

    fixture.componentInstance.onCurrentChange(group, {
      target: { checked: false },
    } as unknown as Event);
    expect(group.controls.endDate.enabled).toBe(true);
  });
});
