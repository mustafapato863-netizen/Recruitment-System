import { useState, type ReactNode } from 'react';
import { DragDropProvider, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/react';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { PriorityChip, type PriorityLevel } from './PriorityChip';
import { Select } from './Select';
import { Icon } from '../Icon';

export interface PipelineCardItem {
  id: string;
  name: string;
  role: string;
  initials: string;
  stageName: string;
  priority?: PriorityLevel;
  priorityLabel?: string;
  isNeonFocus?: boolean;
  scorecardReady?: boolean;
  avatarColor?: string;
  allowedStages?: string[];
}

export interface PipelineStageColumn {
  id: string;
  name: string;
  wipLimit?: number;
  cards: PipelineCardItem[];
}

interface PipelineBoardProps {
  columns: PipelineStageColumn[];
  onMoreActionsClick?: (card: PipelineCardItem) => void;
  onCardMove?: (card: PipelineCardItem, stageName: string) => Promise<void> | void;
  movingCardId?: string | null;
  renderExtra?: (card: PipelineCardItem) => ReactNode;
}

interface PipelineCardProps {
  card: PipelineCardItem;
  columns: PipelineStageColumn[];
  movingCardId?: string | null;
  onMoreActionsClick?: (card: PipelineCardItem) => void;
  onCardMove?: (card: PipelineCardItem, stageName: string) => Promise<void> | void;
  renderExtra?: (card: PipelineCardItem) => ReactNode;
}

function DraggablePipelineCard({
  card,
  columns,
  movingCardId,
  onMoreActionsClick,
  onCardMove,
  renderExtra,
}: PipelineCardProps) {
  const canMove = Boolean(onCardMove && card.allowedStages?.length);
  const { ref, handleRef, isDragging } = useDraggable({
    id: card.id,
    data: { cardId: card.id, allowedStages: card.allowedStages ?? [] },
    disabled: !canMove || movingCardId === card.id,
  });

  return (
    <article
      className={[
        'pipeline-card',
        card.isNeonFocus ? 'neon-focus' : '',
        isDragging ? 'is-dragging' : '',
        movingCardId === card.id ? 'is-moving' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${card.name}, ${card.stageName}`}
      aria-busy={movingCardId === card.id || undefined}
    >
      <div className="pipeline-card-top">
        <Avatar initials={card.initials} size="sm" color={card.avatarColor} />
        {card.priority && <PriorityChip level={card.priority} label={card.priorityLabel} />}
        <div className="pipeline-card-actions">
          {canMove && (
            <IconButton
              ref={(element) => {
                ref(element);
                handleRef(element);
              }}
              className="pipeline-drag-handle"
              label={`Drag ${card.name} to another permitted stage`}
              tone="ghost"
              size="sm"
              disabled={movingCardId === card.id}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon name="grip" size={15} />
            </IconButton>
          )}
          {!card.priority && onMoreActionsClick && (
            <IconButton
              className="table-action"
              label={`More actions for ${card.name}`}
              tone="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onMoreActionsClick(card);
              }}
            >
              <Icon name="more" size={15} />
            </IconButton>
          )}
        </div>
      </div>

      <b>{card.name}</b>
      <small>{card.role}{card.scorecardReady ? ' · scorecard ready' : ''}</small>
      <span className={`pill pill-${card.stageName.toLowerCase().replace(/\s+/g, '-')}`}>{card.stageName}</span>

      {canMove && (
        <label className="pipeline-move-control" onClick={(event) => event.stopPropagation()}>
          <span>Move to stage</span>
          <Select
            value=""
            disabled={movingCardId === card.id}
            aria-label={`Move ${card.name} to stage`}
            onChange={(event) => {
              const stageName = event.target.value;
              if (stageName) void onCardMove?.(card, stageName);
            }}
          >
            <option value="">Move to…</option>
            {columns
              .filter((column) => card.allowedStages?.includes(column.name))
              .map((column) => <option key={column.id} value={column.name}>{column.name}</option>)}
          </Select>
        </label>
      )}

      {renderExtra?.(card)}
    </article>
  );
}

function DroppableColumn({
  column,
  children,
}: {
  column: PipelineStageColumn;
  children: ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    data: { stageName: column.name },
    accept: (source) => {
      const allowedStages = source.data.allowedStages;
      return Array.isArray(allowedStages) && allowedStages.includes(column.name);
    },
  });

  return (
    <section
      ref={ref}
      className={['pipeline-column', isDropTarget ? 'is-drop-target' : ''].filter(Boolean).join(' ')}
      aria-labelledby={`col-${column.id}`}
    >
      {children}
      {(isDropTarget || column.cards.length === 0) && (
        <div className="pipeline-dropzone" aria-hidden="true">
          {isDropTarget ? `Release to move to ${column.name}` : 'No candidates in this stage'}
        </div>
      )}
    </section>
  );
}

export function PipelineBoard({
  columns,
  onMoreActionsClick,
  onCardMove,
  movingCardId,
  renderExtra,
}: PipelineBoardProps) {
  const [announcement, setAnnouncement] = useState('');

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) {
      setAnnouncement('Pipeline move cancelled.');
      return;
    }

    const sourceId = event.operation.source?.id;
    const targetStage = event.operation.target?.data.stageName;
    if (typeof sourceId !== 'string' || typeof targetStage !== 'string') return;
    const card = columns.flatMap((column) => column.cards).find((item) => item.id === sourceId);
    if (!card || !card.allowedStages?.includes(targetStage) || targetStage === card.stageName) return;

    setAnnouncement(`Moving ${card.name} to ${targetStage}.`);
    void onCardMove?.(card, targetStage);
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="pipeline-board-scroll rf-scrollbar" role="region" aria-label="Candidate pipeline board" tabIndex={0}>
        <div className="pipeline-board">
          {columns.map((column) => (
            <DroppableColumn key={column.id} column={column}>
              <header>
                <div>
                  <b id={`col-${column.id}`}>{column.name}</b>
                  <small>
                    {column.cards.length} candidate{column.cards.length === 1 ? '' : 's'}
                    {column.wipLimit ? ` · WIP ${column.wipLimit}` : ''}
                  </small>
                </div>
              </header>

              <div className="pipeline-column-cards">
                {column.cards.map((card) => (
                  <DraggablePipelineCard
                    key={card.id}
                    card={card}
                    columns={columns}
                    movingCardId={movingCardId}
                onMoreActionsClick={onMoreActionsClick}
                    onCardMove={onCardMove}
                    renderExtra={renderExtra}
                  />
                ))}
              </div>
            </DroppableColumn>
          ))}
        </div>
      </div>
      <div className="sr-only" aria-live="polite">{announcement}</div>
    </DragDropProvider>
  );
}
