import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('movies')
export class MovieEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  file_id: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: 0 })
  view_count: number;

  @CreateDateColumn()
  created_at: Date;
}
