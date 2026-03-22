import React, { useState } from 'react';
import { ArrowRight, BookOpen, CreditCard, Award, User, Users, Briefcase } from 'lucide-react';

const iconMap = {
  BookOpen: BookOpen,
  CreditCard: CreditCard,
  Award: Award,
  User: User,
  Users: Users,
  Briefcase: Briefcase,
};

const getCategoryColor = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('course') || t.includes('curriculum')) return '#A855F7';
  if (t.includes('payment') || t.includes('billing'))   return '#EC4899';
  if (t.includes('cert'))                               return '#22C55E';
  if (t.includes('account') || t.includes('access') || t.includes('login')) return '#F97316';
  if (t.includes('mentor'))                             return '#3B82F6';
  if (t.includes('career') || t.includes('placement'))  return '#8B5CF6';
  return '#6366F1';
};

export const CategoryCard = ({ category, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const IconComponent = iconMap[category.icon] || BookOpen;
  const color = getCategoryColor(category.title);

  return (
    <div
      onClick={() => onClick(category.title)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: '20px',
        border: hovered ? `1px solid ${color}55` : '1px solid #e8eaf0',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 12px 32px rgba(0,0,0,0.10)`
          : '0 2px 10px rgba(0,0,0,0.05)',
      }}
    >
      {/* Soft radial glow from top-left icon spreading right — matches Figma */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '120px',
        background: `radial-gradient(ellipse at 15% 40%, ${color}28 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Card body */}
      <div style={{ padding: '24px 24px 18px', flexGrow: 1, display: 'flex', flexDirection: 'column', textAlign: 'left', position: 'relative' }}>
        {/* Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          marginBottom: '18px',
          flexShrink: 0,
        }}>
          <IconComponent size={26} strokeWidth={2} />
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 8px',
          fontSize: '18px',
          fontWeight: '700',
          color: '#0f172a',
          lineHeight: '1.3',
        }}>
          {category.title}
        </h3>

        {/* Description */}
        <p style={{
          margin: '0',
          fontSize: '14px',
          color: '#64748b',
          lineHeight: '1.55',
          fontWeight: '400',
          flexGrow: 1,
        }}>
          {category.description}
        </p>
      </div>

      {/* Card footer row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderTop: '1px solid #f1f5f9',
        position: 'relative',
      }}>
        <span style={{
          backgroundColor: '#f1f5f9',
          color: '#334155',
          fontSize: '13px',
          fontWeight: '600',
          padding: '6px 12px',
          borderRadius: '10px',
        }}>
          {category.articleCount || 0} articles
        </span>
        <ArrowRight
          size={20}
          strokeWidth={2.5}
          color={hovered ? color : '#3B5BDB'}
          style={{
            transition: 'transform 0.2s ease',
            transform: hovered ? 'translateX(3px)' : 'translateX(0)',
          }}
        />
      </div>
    </div>
  );
};
